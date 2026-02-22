#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

if ! command -v npx >/dev/null 2>&1; then
  echo "theme regression skipped: npx not found"
  exit 0
fi

if [[ ! -x "${PWCLI}" ]]; then
  echo "theme regression skipped: playwright wrapper not found (${PWCLI})"
  exit 0
fi

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null

mkdir -p "${ROOT_DIR}/output/playwright/theme"

capture_theme_section() {
  local mode="$1"
  local section="$2"
  local session="theme-${mode}-${section}"
  local out_dir="${ROOT_DIR}/output/playwright/theme/${mode}/${section}"
  mkdir -p "${out_dir}"

  (
    cd "${out_dir}"
    "${PWCLI}" --session "${session}" open "${BASE_URL}/dashboard/#section-${section}"
    "${PWCLI}" --session "${session}" run-code "localStorage.setItem('omac-theme-mode','${mode}'); document.documentElement.setAttribute('data-theme-mode','${mode}'); location.reload();"
    "${PWCLI}" --session "${session}" run-code "await page.waitForTimeout(1200)"
    "${PWCLI}" --session "${session}" screenshot
    "${PWCLI}" --session "${session}" close
  )
}

for mode in system light dark; do
  for section in status approvals audit jobs; do
    capture_theme_section "${mode}" "${section}"
  done
done

echo "theme regression capture completed"
