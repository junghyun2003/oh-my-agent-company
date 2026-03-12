#!/usr/bin/env bash
set -euo pipefail

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=1
fi

BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"

assert_preflight_ready() {
  local profile="${1:-full}"
  curl -fsS "${BASE_URL}/api/ops/preflight" | python3 -c '
import json
import sys

profile = sys.argv[1]
data = json.load(sys.stdin)
issues = set(data.get("issues") or [])
core_issues = {
    "codex_binary_missing",
    "codex_model_not_set",
    "codex_reasoning_effort_unsupported",
    "codex_timeout_too_low",
}

assert data.get("codex_reasoning_effort") in {"low", "medium", "high"}, data

if profile == "quick":
    blocking = sorted(issue for issue in issues if issue in core_issues)
    assert not blocking, {"blocking_issues": blocking, "issues": sorted(issues), "warnings": data.get("warnings") or []}
elif profile == "full":
    assert data.get("ok") is True, data
    assert not issues, data
elif profile == "playwright":
    assert data.get("ok") is True, data
    assert not issues, data
    assert data.get("playwright_ready") is True, data
else:
    raise SystemExit(f"unknown preflight profile: {profile}")
' "${profile}"
}

python3 -m py_compile scripts/orchestrator_server.py
python3 -m py_compile scripts/repo_delivery_smoke.py
python3 -m py_compile scripts/todo_workflow.py
python3 scripts/docs_sync_check.py
python3 scripts/team_policy_check.py
python3 scripts/language_policy_check.py

bash ./scripts/infra_server_ctl.sh ensure >/dev/null
bash ./scripts/api_contract_smoke.sh
assert_preflight_ready quick

if [[ "${QUICK}" == "1" ]]; then
  echo "ci_local_check=ok (quick, non-destructive)"
  exit 0
fi

python3 scripts/repo_delivery_smoke.py
assert_preflight_ready full

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

bash ./scripts/runtime_recovery_smoke.sh
bash ./scripts/codex_runtime_canary.sh

assert_preflight_ready playwright
STRICT_PLAYWRIGHT_E2E=1 bash ./scripts/playwright_ops_e2e.sh
STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/visual_regression_playwright.sh
STRICT_THEME_REGRESSION=1 bash ./scripts/theme_regression_check.sh
assert_preflight_ready playwright

echo "ci_local_check=ok"
