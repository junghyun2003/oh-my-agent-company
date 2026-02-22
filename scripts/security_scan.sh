#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

PATTERN='(api[_-]?key|secret|password|token|authorization:|bearer\s+[A-Za-z0-9._-]{12,})'
TARGETS=("README.md" "AGENTS.md" "scripts" "dashboard")
ALLOWLIST_FILE="${ROOT_DIR}/.security_scan_allowlist"

hits=0
allow_filters=()
if [[ -f "${ALLOWLIST_FILE}" ]]; then
  while IFS= read -r line; do
    line="${line## }"
    [[ -z "${line}" || "${line}" =~ ^# ]] && continue
    allow_filters+=("${line}")
  done < "${ALLOWLIST_FILE}"
fi

filter_hits() {
  local file="$1"
  cp "${file}" "${file}.filtered"
  for rule in "${allow_filters[@]}"; do
    grep -Fv "${rule}" "${file}.filtered" > "${file}.tmp" || true
    mv "${file}.tmp" "${file}.filtered"
  done
}

for t in "${TARGETS[@]}"; do
  if [[ -e "${ROOT_DIR}/${t}" ]]; then
    if rg -n -i --hidden -g '!*.db' -g '!state/**' "${PATTERN}" "${ROOT_DIR}/${t}" >/tmp/security-scan.$$ 2>/dev/null; then
      filter_hits /tmp/security-scan.$$
      if [[ -s /tmp/security-scan.$$.filtered ]]; then
        echo "[warn] potential sensitive patterns in ${t}"
        sed -n '1,80p' /tmp/security-scan.$$.filtered
        hits=1
      fi
    fi
  fi
done
rm -f /tmp/security-scan.$$ /tmp/security-scan.$$.filtered /tmp/security-scan.$$.tmp || true

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  exit 0
fi

if [[ "${hits}" -eq 1 ]]; then
  echo "security_scan=warn"
  exit 1
fi

echo "security_scan=ok"
