#!/usr/bin/env bash
set -euo pipefail

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=1
fi

python3 -m py_compile scripts/orchestrator_server.py
python3 -m py_compile scripts/todo_workflow.py
python3 scripts/docs_sync_check.py

bash ./scripts/infra_server_ctl.sh ensure >/dev/null
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

if [[ "${QUICK}" != "1" ]]; then
  bash ./scripts/theme_regression_check.sh
fi

echo "ci_local_check=ok"
