#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
RUN_SMOKE="${RUN_SMOKE:-0}"
REQUIRE_NODE="${REQUIRE_NODE:-0}"

usage() {
  cat <<'EOF'
usage: bash ./scripts/bootstrap_local.sh [--with-smoke]

기본 동작:
- npm install (가능한 경우)
- orchestrator ensure
- /api/health 확인

옵션:
- --with-smoke   샘플 request/job/audit를 생성하는 smoke flow까지 실행
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-smoke)
      RUN_SMOKE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

echo "[bootstrap] checking required commands..."
for cmd in python3 curl bash; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "missing command: ${cmd}" >&2
    exit 1
  fi
done

if command -v npm >/dev/null 2>&1; then
  echo "[bootstrap] npm install (no-audit/no-fund)..."
  npm install --no-audit --no-fund
else
  if [[ "${REQUIRE_NODE}" == "1" ]]; then
    echo "[bootstrap] npm is required but not found." >&2
    echo "install Node.js/npm and retry:" >&2
    echo "  node --version" >&2
    echo "  npm --version" >&2
    exit 1
  fi
  echo "[bootstrap] npm not found: skipping npm install"
fi

echo "[bootstrap] ensuring server..."
bash ./scripts/infra_server_ctl.sh ensure

echo "[bootstrap] health check..."
curl -fsS "${BASE_URL}/api/health" >/dev/null

if [[ "${RUN_SMOKE}" == "1" ]]; then
  echo "[bootstrap] smoke enabled: sample request/job/audit data will be created"
  echo "[bootstrap] running smoke flow..."
  bash ./scripts/smoke_core_flows.sh
else
  echo "[bootstrap] smoke skipped (default). use --with-smoke to run the sample flow."
fi

echo "[bootstrap] done"
echo "dashboard: ${BASE_URL}/dashboard/"
