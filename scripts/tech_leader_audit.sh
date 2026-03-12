#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${ORCHESTRATOR_PORT:-18765}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

pass() { printf "[PASS] %s\n" "$1"; }
warn() { printf "[WARN] %s\n" "$1"; }
fail() { printf "[FAIL] %s\n" "$1"; }

EXIT_CODE=0

printf "== Tech Leader Audit ==\n"
printf "workspace: %s\n" "${ROOT_DIR}"
printf "port: %s\n" "${PORT}"

for path in \
  "${ROOT_DIR}/dashboard/index.html" \
  "${ROOT_DIR}/dashboard/app.js" \
  "${ROOT_DIR}/dashboard/styles.css" \
  "${ROOT_DIR}/scripts/orchestrator_server.py" \
  "${ROOT_DIR}/state/agent_company.db"
do
  if [[ -f "${path}" ]]; then
    pass "required file exists: ${path}"
  else
    fail "missing required file: ${path}"
    EXIT_CODE=1
  fi
done

if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  pass "health endpoint reachable: ${HEALTH_URL}"
else
  warn "health endpoint unavailable: ${HEALTH_URL}"
  warn "tip: scripts/infra_server_ctl.sh start"
fi

if command -v rg >/dev/null 2>&1; then
  if rg -n "oh-my-agnet-company" "${ROOT_DIR}" -g '!scripts/tech_leader_audit.sh' >/dev/null 2>&1; then
    fail "found legacy brand typo: oh-my-agnet-company"
    rg -n "oh-my-agnet-company" "${ROOT_DIR}" -g '!scripts/tech_leader_audit.sh' || true
    EXIT_CODE=1
  else
    pass "brand string consistency check passed"
  fi
else
  warn "rg not found; skipped typo scan"
fi

if python3 "${ROOT_DIR}/scripts/docs_sync_check.py" >/dev/null 2>&1; then
  pass "docs sync check passed"
else
  fail "docs sync check failed"
  EXIT_CODE=1
fi

if python3 "${ROOT_DIR}/scripts/team_policy_check.py" >/dev/null 2>&1; then
  pass "team policy check passed"
else
  fail "team policy check failed"
  EXIT_CODE=1
fi

if python3 "${ROOT_DIR}/scripts/language_policy_check.py" >/dev/null 2>&1; then
  pass "language policy check passed"
else
  fail "language policy check failed"
  EXIT_CODE=1
fi

if [[ ${EXIT_CODE} -eq 0 ]]; then
  printf "== Result: OK ==\n"
else
  printf "== Result: FAIL ==\n"
fi

exit "${EXIT_CODE}"
