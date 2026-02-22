#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
WEBHOOK_URL="${INCIDENT_WEBHOOK_URL:-}"
OUT_FILE="${ROOT_DIR}/state/incident_notify.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --webhook) WEBHOOK_URL="${2:-}"; shift 2 ;;
    --out) OUT_FILE="${2:-}"; shift 2 ;;
    *) echo "usage: $0 [--dry-run] [--webhook <url>] [--out <file>]" >&2; exit 2 ;;
  esac
done

summary="$(bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" incident-summary 2>&1 || true)"
mkdir -p "$(dirname "${OUT_FILE}")"
printf '%s\n%s\n\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "${summary}" >> "${OUT_FILE}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  echo "out=${OUT_FILE}"
  echo "summary_begin"
  echo "${summary}" | sed -n '1,20p'
  echo "summary_end"
  exit 0
fi

if [[ -n "${WEBHOOK_URL}" ]]; then
  payload="{\"text\":$(python3 - <<'PY' "${summary}"
import json,sys
print(json.dumps(sys.argv[1]))
PY
)}"
  curl -fsS -X POST "${WEBHOOK_URL}" -H 'Content-Type: application/json' -d "${payload}" >/dev/null
  echo "webhook_sent=1"
else
  echo "webhook_sent=0"
fi

echo "saved=${OUT_FILE}"
