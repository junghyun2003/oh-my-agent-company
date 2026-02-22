#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

PATTERN='(api[_-]?key|secret|password|token|authorization:|bearer\s+[A-Za-z0-9._-]{12,})'
TARGETS=("README.md" "AGENTS.md" "scripts" "dashboard")

hits=0
for t in "${TARGETS[@]}"; do
  if [[ -e "${ROOT_DIR}/${t}" ]]; then
    if rg -n -i --hidden -g '!*.db' -g '!state/**' "${PATTERN}" "${ROOT_DIR}/${t}" >/tmp/security-scan.$$ 2>/dev/null; then
      echo "[warn] potential sensitive patterns in ${t}"
      sed -n '1,80p' /tmp/security-scan.$$
      hits=1
    fi
  fi
done
rm -f /tmp/security-scan.$$ || true

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  exit 0
fi

if [[ "${hits}" -eq 1 ]]; then
  echo "security_scan=warn"
  exit 1
fi

echo "security_scan=ok"
