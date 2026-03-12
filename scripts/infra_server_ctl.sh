#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="${ROOT_DIR}/scripts/infra_server_ctl.sh"
PORT="${ORCHESTRATOR_PORT:-18765}"
PID_FILE="${ROOT_DIR}/state/orchestrator.pid"
WATCHDOG_PID_FILE="${ROOT_DIR}/state/orchestrator_watchdog.pid"
LOG_FILE="${ROOT_DIR}/state/orchestrator.log"
WATCHDOG_LOG_FILE="${ROOT_DIR}/state/orchestrator_watchdog.log"
LIFECYCLE_LOG_FILE="${ROOT_DIR}/state/orchestrator_lifecycle.log"
SERVER_PY="${ROOT_DIR}/scripts/orchestrator_server.py"

health_url="http://localhost:${PORT}/api/health"
LOCK_DIR="${ROOT_DIR}/state/.infra_ctl.lock"
LOCK_PID_FILE="${LOCK_DIR}/pid"
ENSURE_MAX_ATTEMPTS="${ENSURE_MAX_ATTEMPTS:-3}"
STABILITY_PROBES="${STABILITY_PROBES:-3}"
AUTO_WATCHDOG="${INFRA_AUTO_WATCHDOG:-1}"
START_GUARD_SEC="${START_GUARD_SEC:-60}"
START_GUARD_INTERVAL_SEC="${START_GUARD_INTERVAL_SEC:-5}"
HEALTH_CURL_TIMEOUT_SEC="${HEALTH_CURL_TIMEOUT_SEC:-2}"

get_port_pid() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true
}

process_cmd() {
  local pid="${1:-}"
  if [[ -z "${pid}" ]]; then
    return 1
  fi
  ps -p "${pid}" -o command= 2>/dev/null || true
}

is_orchestrator_pid() {
  local pid="${1:-}"
  local cmd
  cmd="$(process_cmd "${pid}")"
  [[ -n "${cmd}" && "${cmd}" == *"orchestrator_server.py"* ]]
}

wait_port_release() {
  local tries="${1:-25}"
  local i=0
  while [[ "${i}" -lt "${tries}" ]]; do
    if [[ -z "$(get_port_pid)" ]]; then
      return 0
    fi
    sleep 0.2
    i=$((i + 1))
  done
  return 1
}

with_lock() {
  mkdir -p "${ROOT_DIR}/state"
  local i=0
  while ! mkdir "${LOCK_DIR}" 2>/dev/null; do
    # Recover stale lock: lock owner PID is missing or invalid.
    if [[ -f "${LOCK_PID_FILE}" ]]; then
      local lock_pid
      lock_pid="$(cat "${LOCK_PID_FILE}" 2>/dev/null || true)"
      if [[ -z "${lock_pid}" ]] || ! ps -p "${lock_pid}" > /dev/null 2>&1; then
        rm -rf "${LOCK_DIR}" >/dev/null 2>&1 || true
        continue
      fi
    else
      # Lock directory exists without owner metadata.
      rm -rf "${LOCK_DIR}" >/dev/null 2>&1 || true
      continue
    fi
    i=$((i + 1))
    if [[ "${i}" -ge 50 ]]; then
      echo "infra control lock busy: ${LOCK_DIR}" >&2
      return 1
    fi
    sleep 0.1
  done
  echo "$$" > "${LOCK_PID_FILE}"
  # shellcheck disable=SC2064
  trap "rm -f \"${LOCK_PID_FILE}\" >/dev/null 2>&1 || true; rmdir \"${LOCK_DIR}\" >/dev/null 2>&1 || true" EXIT
  "$@"
}

spawn_detached() {
  local log_file="$1"
  shift
  python3 - "${ROOT_DIR}" "${log_file}" "$@" <<'PY'
import os
import subprocess
import sys

root_dir = sys.argv[1]
log_file = sys.argv[2]
cmd = sys.argv[3:]

os.makedirs(os.path.dirname(log_file), exist_ok=True)
with open(log_file, "ab", buffering=0) as log:
    proc = subprocess.Popen(
        cmd,
        cwd=root_dir,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
        close_fds=True,
    )
print(proc.pid)
PY
}

is_running() {
  if [[ ! -f "${PID_FILE}" ]]; then
    # PID file can be lost; recover from listening socket when possible.
    local port_pid
    port_pid="$(get_port_pid)"
    if [[ -n "${port_pid}" ]] && is_orchestrator_pid "${port_pid}" && curl -fsS --max-time "${HEALTH_CURL_TIMEOUT_SEC}" "${health_url}" > /dev/null 2>&1; then
      echo "${port_pid}" > "${PID_FILE}"
      return 0
    fi
    return 1
  fi
  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${PID_FILE}"
    return 1
  fi
  if ps -p "${pid}" > /dev/null 2>&1; then
    return 0
  fi
  # stale pid file
  rm -f "${PID_FILE}"
  return 1
}

wait_health() {
  local tries="${1:-25}"
  local i=0
  while [[ "${i}" -lt "${tries}" ]]; do
    if curl -fsS --max-time "${HEALTH_CURL_TIMEOUT_SEC}" "${health_url}" > /dev/null 2>&1; then
      return 0
    fi
    sleep 0.4
    i=$((i + 1))
  done
  return 1
}

health_ok() {
  curl -fsS --max-time "${HEALTH_CURL_TIMEOUT_SEC}" "${health_url}" > /dev/null 2>&1
}

ts_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log_lifecycle() {
  local kind="${1:-event}"
  local detail="${2:-}"
  mkdir -p "${ROOT_DIR}/state"
  touch "${LIFECYCLE_LOG_FILE}"
  echo "$(ts_utc)|${kind}|${detail}" >> "${LIFECYCLE_LOG_FILE}"
}

start_flap_guard() {
  local pid="${1:-}"
  if [[ -z "${pid}" ]]; then
    return 0
  fi
  (
    local elapsed=0
    sleep "${START_GUARD_INTERVAL_SEC}"
    elapsed="${START_GUARD_INTERVAL_SEC}"
    while [[ "${elapsed}" -le "${START_GUARD_SEC}" ]]; do
      if ! ps -p "${pid}" > /dev/null 2>&1; then
        log_lifecycle "FLAP_EXIT" "pid=${pid} elapsed_sec=${elapsed}"
        "${SCRIPT_PATH}" ensure >> "${LOG_FILE}" 2>&1 || true
        exit 0
      fi
      if ! health_ok; then
        log_lifecycle "FLAP_HEALTH_FAIL" "pid=${pid} elapsed_sec=${elapsed}"
      fi
      sleep "${START_GUARD_INTERVAL_SEC}"
      elapsed=$((elapsed + START_GUARD_INTERVAL_SEC))
    done
    log_lifecycle "START_STABLE" "pid=${pid} guard_sec=${START_GUARD_SEC}"
  ) >/dev/null 2>&1 &
}

wait_health_stable() {
  local probes="${1:-${STABILITY_PROBES}}"
  local i=0
  while [[ "${i}" -lt "${probes}" ]]; do
    if ! health_ok; then
      return 1
    fi
    sleep 0.5
    i=$((i + 1))
  done
  return 0
}

auto_watchdog_hint() {
  if [[ "${AUTO_WATCHDOG}" != "1" ]]; then
    return 0
  fi
  if ! is_watchdog_running; then
    watchdog_start > /dev/null 2>&1 || true
  fi
}

start_server() {
  if is_running && health_ok; then
    echo "already running: pid $(cat "${PID_FILE}")"
    log_lifecycle "START_SKIP_ALREADY_RUNNING" "pid=$(cat "${PID_FILE}")"
    auto_watchdog_hint
    return 0
  fi

  # Recover from orphaned process on the target port before starting a new one.
  local port_pid
  port_pid="$(get_port_pid)"
  if [[ -n "${port_pid}" ]]; then
    if is_orchestrator_pid "${port_pid}"; then
      if health_ok; then
        echo "${port_pid}" > "${PID_FILE}"
        echo "already running (recovered): pid ${port_pid}"
        log_lifecycle "START_RECOVER_EXISTING" "pid=${port_pid}"
        auto_watchdog_hint
        return 0
      fi
      echo "found unhealthy orchestrator pid ${port_pid}; restarting..." >&2
      kill "${port_pid}" || true
      sleep 0.4
      if ps -p "${port_pid}" > /dev/null 2>&1; then
        kill -9 "${port_pid}" || true
      fi
      if ! wait_port_release; then
        echo "port ${PORT} did not release after stopping pid ${port_pid}" >&2
        return 1
      fi
    else
      echo "port ${PORT} is already in use by pid ${port_pid}" >&2
      echo "cmd: $(process_cmd "${port_pid}")" >&2
      echo "abort start to avoid killing unrelated process" >&2
      return 1
    fi
  fi

  mkdir -p "${ROOT_DIR}/state"
  touch "${LOG_FILE}"
  local pid
  pid="$(spawn_detached "${LOG_FILE}" env ORCHESTRATOR_PORT="${PORT}" python3 "${SERVER_PY}")"
  echo "${pid}" > "${PID_FILE}"

  if wait_health && wait_health_stable; then
    if is_running && health_ok; then
      echo "started: pid ${pid} port ${PORT}"
      log_lifecycle "START_OK" "pid=${pid} port=${PORT}"
      start_flap_guard "${pid}"
      auto_watchdog_hint
      return 0
    fi
  fi

  echo "failed to start; check ${LOG_FILE}" >&2
  log_lifecycle "START_FAIL" "port=${PORT}"
  rm -f "${PID_FILE}"
  tail -n 80 "${LOG_FILE}" >&2 || true
  return 1
}

stop_server() {
  local pid=""
  if is_running; then
    pid="$(cat "${PID_FILE}")"
  else
    pid="$(get_port_pid)"
    if [[ -z "${pid}" ]]; then
      echo "not running"
      rm -f "${PID_FILE}"
      return 0
    fi
    if ! is_orchestrator_pid "${pid}"; then
      echo "port ${PORT} is used by non-orchestrator pid ${pid}; skip stop" >&2
      return 1
    fi
  fi

  kill "${pid}" || true
  sleep 0.5
  if ps -p "${pid}" > /dev/null 2>&1; then
    kill -9 "${pid}" || true
  fi
  wait_port_release 20 || true
  rm -f "${PID_FILE}"
  log_lifecycle "STOP_OK" "pid=${pid}"
  echo "stopped: pid ${pid}"
}

safe_restart() {
  if ! python3 -m py_compile "${SERVER_PY}" > /dev/null 2>&1; then
    echo "restart aborted: python syntax check failed (server kept as-is)" >&2
    python3 -m py_compile "${SERVER_PY}"
    return 1
  fi
  stop_server
  start_server
}

status_server() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if health_ok; then
      echo "running: pid ${pid} port ${PORT} (healthy)"
    else
      echo "running: pid ${pid} port ${PORT} (unhealthy)"
      return 1
    fi
  else
    echo "not running"
    if [[ -f "${LIFECYCLE_LOG_FILE}" ]]; then
      echo "hint: recent lifecycle events"
      tail -n 3 "${LIFECYCLE_LOG_FILE}" || true
    fi
    return 1
  fi
}

ensure_server() {
  if status_server > /dev/null 2>&1 && wait_health_stable; then
    echo "healthy: pid $(cat "${PID_FILE}") port ${PORT}"
    log_lifecycle "ENSURE_HEALTHY" "pid=$(cat "${PID_FILE}") port=${PORT}"
    auto_watchdog_hint
    return 0
  fi
  echo "recovering server on port ${PORT}..."
  local attempt=1
  while [[ "${attempt}" -le "${ENSURE_MAX_ATTEMPTS}" ]]; do
    local port_pid
    port_pid="$(get_port_pid)"
    if [[ -n "${port_pid}" ]] && is_orchestrator_pid "${port_pid}"; then
      echo "attempt ${attempt}/${ENSURE_MAX_ATTEMPTS}: stopping unhealthy orchestrator pid ${port_pid} before restart..."
      kill "${port_pid}" || true
      sleep 0.4
      if ps -p "${port_pid}" > /dev/null 2>&1; then
        kill -9 "${port_pid}" || true
      fi
      wait_port_release 20 || true
    fi
    if start_server && status_server > /dev/null 2>&1 && wait_health_stable; then
      echo "recovered on attempt ${attempt}/${ENSURE_MAX_ATTEMPTS}"
      log_lifecycle "ENSURE_RECOVERED" "attempt=${attempt} port=${PORT}"
      auto_watchdog_hint
      return 0
    fi
    sleep "${attempt}"
    attempt=$((attempt + 1))
  done
  echo "failed to recover server after ${ENSURE_MAX_ATTEMPTS} attempts" >&2
  log_lifecycle "ENSURE_FAIL" "attempts=${ENSURE_MAX_ATTEMPTS} port=${PORT}"
  return 1
}

doctor_server() {
  local pid_file_pid=""
  local port_pid=""
  [[ -f "${PID_FILE}" ]] && pid_file_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  port_pid="$(get_port_pid)"

  echo "port=${PORT}"
  echo "pid_file=${PID_FILE}"
  echo "pid_file_pid=${pid_file_pid:-none}"
  echo "port_pid=${port_pid:-none}"
  if [[ -n "${port_pid}" ]]; then
    echo "port_cmd=$(process_cmd "${port_pid}")"
  fi
  if health_ok; then
    echo "health=ok"
  else
    echo "health=fail"
  fi
  incident_report || return 1
}

incident_report() {
  local pid_file_pid=""
  local port_pid=""
  local health="fail"
  local diagnosis_code="HEALTH_FAIL"
  local reason="health endpoint not reachable"
  local recommendation="run: ./scripts/infra_server_ctl.sh ensure"

  [[ -f "${PID_FILE}" ]] && pid_file_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  port_pid="$(get_port_pid)"
  if health_ok; then
    health="ok"
  fi

  if [[ -z "${port_pid}" ]]; then
    diagnosis_code="NOT_RUNNING"
    reason="no process listening on orchestrator port"
    recommendation="run: ./scripts/infra_server_ctl.sh start"
  elif ! is_orchestrator_pid "${port_pid}"; then
    diagnosis_code="PORT_CONFLICT"
    reason="port is occupied by non-orchestrator process"
    recommendation="free the port or change ORCHESTRATOR_PORT"
  elif [[ "${health}" != "ok" ]]; then
    diagnosis_code="HEALTH_FAIL"
    reason="orchestrator process exists but health check failed"
    recommendation="run: ./scripts/infra_server_ctl.sh restart && ./scripts/infra_server_ctl.sh logs 120"
  elif [[ -n "${pid_file_pid}" && "${pid_file_pid}" != "${port_pid}" ]]; then
    diagnosis_code="PID_STALE"
    reason="pid file does not match listening process"
    recommendation="run: ./scripts/infra_server_ctl.sh ensure"
  else
    diagnosis_code="OK"
    reason="orchestrator is healthy"
    recommendation="no action required"
  fi

  echo "diagnosis_code=${diagnosis_code}"
  echo "diagnosis_reason=${reason}"
  echo "recommendation=${recommendation}"
  [[ "${diagnosis_code}" == "OK" ]]
}

incident_summary() {
  local diag_ok=0
  if incident_report; then
    diag_ok=1
  fi
  echo "----"
  echo "port=${PORT}"
  if [[ -f "${PID_FILE}" ]]; then
    echo "pid=$(cat "${PID_FILE}" 2>/dev/null || echo none)"
  else
    echo "pid=none"
  fi
  if [[ -f "${LIFECYCLE_LOG_FILE}" ]]; then
    echo "lifecycle_tail:"
    tail -n 5 "${LIFECYCLE_LOG_FILE}" | sed 's/^/  /'
  else
    echo "lifecycle_tail: none"
  fi

  if curl -fsS --max-time "${HEALTH_CURL_TIMEOUT_SEC}" "${health_url}" >/tmp/omc-health.$$ 2>/dev/null; then
    echo "health_summary:"
    python3 - <<'PY' /tmp/omc-health.$$
import json,sys
p=sys.argv[1]
try:
    with open(p,encoding='utf-8') as f:
        d=json.load(f)
except Exception:
    print("  parse_error=true")
    raise SystemExit(0)
wh=d.get("worker_health",{}) if isinstance(d,dict) else {}
workers=wh.get("workers",[]) if isinstance(wh,dict) else []
stale=wh.get("stale_workers","?")
recovery=(wh.get("recovery_loop") or {}).get("stale","?")
print(f"  ok={d.get('ok')}")
print(f"  stale_workers={stale}")
print(f"  recovery_stale={recovery}")
print(f"  worker_count={len(workers)}")
PY
    rm -f /tmp/omc-health.$$ || true
  else
    echo "health_summary: unavailable"
  fi
  [[ "${diag_ok}" -eq 1 ]]
}

is_watchdog_running() {
  if [[ ! -f "${WATCHDOG_PID_FILE}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${WATCHDOG_PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${WATCHDOG_PID_FILE}"
    return 1
  fi
  if ps -p "${pid}" > /dev/null 2>&1; then
    return 0
  fi
  rm -f "${WATCHDOG_PID_FILE}"
  return 1
}

watchdog_start() {
  if is_watchdog_running; then
    echo "watchdog already running: pid $(cat "${WATCHDOG_PID_FILE}")"
    return 0
  fi
  mkdir -p "${ROOT_DIR}/state"
  touch "${WATCHDOG_LOG_FILE}"
  local pid
  pid="$(spawn_detached "${WATCHDOG_LOG_FILE}" bash -lc "
    while true; do
      '${SCRIPT_PATH}' ensure >> '${WATCHDOG_LOG_FILE}' 2>&1 || true
      sleep 5
    done
  ")"
  echo "${pid}" > "${WATCHDOG_PID_FILE}"
  echo "watchdog started: pid ${pid}"
}

watchdog_stop() {
  if ! is_watchdog_running; then
    echo "watchdog not running"
    rm -f "${WATCHDOG_PID_FILE}"
    return 0
  fi
  local pid
  pid="$(cat "${WATCHDOG_PID_FILE}")"
  kill "${pid}" || true
  sleep 0.3
  if ps -p "${pid}" > /dev/null 2>&1; then
    kill -9 "${pid}" || true
  fi
  rm -f "${WATCHDOG_PID_FILE}"
  echo "watchdog stopped: pid ${pid}"
}

watchdog_status() {
  if is_watchdog_running; then
    echo "watchdog running: pid $(cat "${WATCHDOG_PID_FILE}")"
  else
    echo "watchdog not running"
    return 1
  fi
}

case "${1:-}" in
  start) with_lock start_server ;;
  stop) with_lock stop_server ;;
  restart) with_lock safe_restart ;;
  status) status_server ;;
  ensure) with_lock ensure_server ;;
  doctor) doctor_server ;;
  watch-start) watchdog_start ;;
  watch-stop) watchdog_stop ;;
  watch-status) watchdog_status ;;
  watch-logs) tail -n "${2:-120}" "${WATCHDOG_LOG_FILE}" || true ;;
  incident) incident_report ;;
  incident-summary) incident_summary ;;
  health)
    curl -fsS "${health_url}" | sed 's/^/health: /'
    ;;
  logs)
    tail -n "${2:-120}" "${LOG_FILE}" || true
    ;;
  *)
    echo "usage: $0 {start|stop|restart|status|ensure|doctor|incident|incident-summary|watch-start|watch-stop|watch-status|watch-logs [n]|health|logs [n]}" >&2
    exit 2
    ;;
esac
