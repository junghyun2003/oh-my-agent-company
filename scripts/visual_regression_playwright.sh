#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

mkdir -p "${ROOT_DIR}/output/playwright/current" "${ROOT_DIR}/output/playwright/baseline"

if ! command -v npx >/dev/null 2>&1; then
  cat <<'EOM'
Playwright visual regression skipped: npx not found.

# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
EOM
  exit 0
fi

if [[ ! -x "${PWCLI}" ]]; then
  echo "playwright wrapper not found: ${PWCLI}" >&2
  exit 1
fi

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

capture_section() {
  local label="$1"
  local url="$2"
  local session="omc-${label}"
  local current_dir="${ROOT_DIR}/output/playwright/current/${label}"
  local baseline_dir="${ROOT_DIR}/output/playwright/baseline/${label}"
  mkdir -p "${current_dir}" "${baseline_dir}"

  local before after newest baseline
  before="$(ls -1t "${current_dir}"/*.png 2>/dev/null | head -n 1 || true)"

  (
    cd "${current_dir}"
    "${PWCLI}" --session "${session}" open "${url}"
    "${PWCLI}" --session "${session}" run-code "await page.waitForTimeout(900)"
    "${PWCLI}" --session "${session}" screenshot
    "${PWCLI}" --session "${session}" close
  )

  after="$(ls -1t "${current_dir}"/*.png 2>/dev/null | head -n 1 || true)"
  if [[ -z "${after}" || "${after}" == "${before}" ]]; then
    echo "no screenshot captured for ${label}" >&2
    return 1
  fi

  baseline="${baseline_dir}/baseline.png"
  if [[ ! -f "${baseline}" ]]; then
    cp "${after}" "${baseline}"
    echo "baseline_created:${label}:${baseline}"
    return 0
  fi

  if [[ "$(hash_file "${after}")" != "$(hash_file "${baseline}")" ]]; then
    newest="${baseline_dir}/latest-mismatch.png"
    cp "${after}" "${newest}"
    echo "visual_regression:${label}:${newest}"
    return 2
  fi

  echo "visual_ok:${label}"
  return 0
}

failures=0
sections=(
  "status|${BASE_URL}/dashboard/#section-status"
  "approval|${BASE_URL}/dashboard/#section-approvals"
  "audit|${BASE_URL}/dashboard/#section-audit"
  "assign|${BASE_URL}/dashboard/#section-jobs"
)

for spec in "${sections[@]}"; do
  label="${spec%%|*}"
  url="${spec##*|}"
  if ! capture_section "${label}" "${url}"; then
    rc=$?
    if [[ "${rc}" -eq 2 ]]; then
      failures=$((failures + 1))
      continue
    fi
    exit "${rc}"
  fi
done

if [[ "${failures}" -gt 0 ]]; then
  echo "playwright visual regression failed: ${failures} section(s) changed" >&2
  exit 1
fi

echo "playwright visual regression passed"
