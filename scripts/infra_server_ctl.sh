#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ORCHESTRATOR_PORT:-18765}"
PID_FILE="${ROOT_DIR}/state/orchestrator.pid"
LOG_FILE="${ROOT_DIR}/state/orchestrator.log"
SERVER_PY="${ROOT_DIR}/scripts/orchestrator_server.py"

health_url="http://localhost:${PORT}/api/health"

is_running() {
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] || return 1
  ps -p "${pid}" > /dev/null 2>&1
}

wait_health() {
  local tries="${1:-25}"
  local i=0
  while [[ "${i}" -lt "${tries}" ]]; do
    if curl -fsS "${health_url}" > /dev/null 2>&1; then
      return 0
    fi
    sleep 0.4
    i=$((i + 1))
  done
  return 1
}

start_server() {
  if is_running && curl -fsS "${health_url}" > /dev/null 2>&1; then
    echo "already running: pid $(cat "${PID_FILE}")"
    return 0
  fi

  mkdir -p "${ROOT_DIR}/state"
  : > "${LOG_FILE}"
  nohup env ORCHESTRATOR_PORT="${PORT}" python3 "${SERVER_PY}" >> "${LOG_FILE}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"

  if wait_health; then
    echo "started: pid ${pid} port ${PORT}"
    return 0
  fi

  echo "failed to start; check ${LOG_FILE}" >&2
  tail -n 80 "${LOG_FILE}" >&2 || true
  return 1
}

stop_server() {
  if ! is_running; then
    echo "not running"
    rm -f "${PID_FILE}"
    return 0
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  kill "${pid}" || true
  sleep 0.5
  if ps -p "${pid}" > /dev/null 2>&1; then
    kill -9 "${pid}" || true
  fi
  rm -f "${PID_FILE}"
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
    if curl -fsS "${health_url}" > /dev/null 2>&1; then
      echo "running: pid ${pid} port ${PORT} (healthy)"
    else
      echo "running: pid ${pid} port ${PORT} (unhealthy)"
      return 1
    fi
  else
    echo "not running"
    return 1
  fi
}

case "${1:-}" in
  start) start_server ;;
  stop) stop_server ;;
  restart) safe_restart ;;
  status) status_server ;;
  health)
    curl -fsS "${health_url}" | sed 's/^/health: /'
    ;;
  logs)
    tail -n "${2:-120}" "${LOG_FILE}" || true
    ;;
  *)
    echo "usage: $0 {start|stop|restart|status|health|logs [n]}" >&2
    exit 2
    ;;
esac
