#!/usr/bin/env bash
set -euo pipefail

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=1
fi

BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"

assert_preflight_ready() {
  local require_playwright="${1:-0}"
  curl -fsS "${BASE_URL}/api/ops/preflight" | python3 -c 'import json,sys; require_playwright=sys.argv[1]=="1"; d=json.load(sys.stdin); assert d.get("ok") is True, d; assert not d.get("issues"), d; assert d.get("codex_reasoning_effort") in {"low","medium","high"}, d; assert not require_playwright or d.get("playwright_ready") is True, d' "${require_playwright}"
}

python3 -m py_compile scripts/orchestrator_server.py
python3 -m py_compile scripts/todo_workflow.py
python3 scripts/docs_sync_check.py

bash ./scripts/infra_server_ctl.sh ensure >/dev/null
bash ./scripts/api_contract_smoke.sh
assert_preflight_ready 0

attempt=1
max_attempts=3
while [[ "${attempt}" -le "${max_attempts}" ]]; do
  if bash ./scripts/smoke_core_flows.sh; then
    break
  fi
  if [[ "${attempt}" -ge "${max_attempts}" ]]; then
    echo "smoke failed after ${max_attempts} attempts" >&2
    exit 1
  fi
  bash ./scripts/infra_server_ctl.sh ensure >/dev/null || true
  sleep "${attempt}"
  attempt=$((attempt + 1))
done

bash ./scripts/codex_runtime_canary.sh

if [[ "${QUICK}" != "1" ]]; then
  assert_preflight_ready 1
  STRICT_PLAYWRIGHT_E2E=1 bash ./scripts/playwright_ops_e2e.sh
  STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/visual_regression_playwright.sh
  STRICT_THEME_REGRESSION=1 bash ./scripts/theme_regression_check.sh
  assert_preflight_ready 1
fi

echo "ci_local_check=ok"
