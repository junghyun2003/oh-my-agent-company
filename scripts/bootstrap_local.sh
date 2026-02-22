#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
RUN_SMOKE="${RUN_SMOKE:-1}"

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
  echo "[bootstrap] npm not found: skipping npm install"
fi

echo "[bootstrap] ensuring server..."
bash ./scripts/infra_server_ctl.sh ensure

echo "[bootstrap] health check..."
curl -fsS "${BASE_URL}/api/health" >/dev/null

if [[ "${RUN_SMOKE}" == "1" ]]; then
  echo "[bootstrap] running smoke flow..."
  bash ./scripts/smoke_core_flows.sh
fi

echo "[bootstrap] done"
echo "dashboard: ${BASE_URL}/dashboard/"
