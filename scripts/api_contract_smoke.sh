#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"

bash ./scripts/infra_server_ctl.sh ensure >/dev/null

check_json() {
  local path="$1"
  local py="$2"
  curl -fsS "${BASE_URL}${path}" | python3 -c "import json,sys; d=json.load(sys.stdin); ${py}"
}

check_json "/api/health" "assert 'ok' in d and 'worker_health' in d"
check_json "/api/state" "assert 'agents' in d and 'summary' in d"
check_json "/api/requests?limit=5&offset=0" "assert 'requests' in d"
check_json "/api/jobs?limit=5&offset=0" "assert 'jobs' in d"
check_json "/api/audit?limit=5&offset=0" "assert 'events' in d and 'total' in d"
check_json "/api/ops/queue" "assert d.get('ok') is True and 'queue' in d"
check_json "/api/ops/runtime" "assert 'uptime_sec' in d and 'worker_health' in d"
check_json "/api/ops/preflight" "assert 'ok' in d and 'issues' in d"

echo "api_contract_smoke=ok"
