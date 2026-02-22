#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

LATEST="$(bash "${ROOT_DIR}/scripts/db_maintenance.sh" list | head -n 1 || true)"
if [[ -z "${LATEST}" ]]; then
  echo "no backup found; creating one..."
  bash "${ROOT_DIR}/scripts/db_maintenance.sh" backup >/dev/null
  LATEST="$(bash "${ROOT_DIR}/scripts/db_maintenance.sh" list | head -n 1 || true)"
fi

if [[ -z "${LATEST}" ]]; then
  echo "backup unavailable" >&2
  exit 1
fi

echo "drill_target=${LATEST}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  exit 0
fi

bash "${ROOT_DIR}/scripts/db_maintenance.sh" restore "${LATEST}"
bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null
curl -fsS "http://localhost:${ORCHESTRATOR_PORT:-18765}/api/health" >/dev/null
curl -fsS "http://localhost:${ORCHESTRATOR_PORT:-18765}/api/jobs?limit=1&offset=0" >/dev/null
curl -fsS "http://localhost:${ORCHESTRATOR_PORT:-18765}/api/audit?limit=1&offset=0" >/dev/null

echo "restore_drill=ok"
