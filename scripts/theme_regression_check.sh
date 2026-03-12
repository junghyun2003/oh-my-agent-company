#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
STRICT_THEME_REGRESSION="${STRICT_THEME_REGRESSION:-0}"

# shellcheck source=/dev/null
source "${ROOT_DIR}/scripts/playwright_common.sh"

ensure_playwright_ready "${STRICT_THEME_REGRESSION}" || {
  rc=$?
  if [[ "${rc}" -eq 2 ]]; then
    echo "theme regression skipped: missing Playwright prerequisite"
    exit 0
  fi
  exit "${rc}"
}

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null

mkdir -p "${ROOT_DIR}/output/playwright/theme"

pw_run_js() {
  local session="$1"
  local body="$2"
  "${PWCLI}" --session "${session}" run-code "$(printf 'async (page) => {\n%s\n}\n' "${body}")"
}

capture_theme_section() {
  local mode="$1"
  local section="$2"
  local mode_tag="${mode:0:1}"
  local section_tag="${section:0:3}"
  local session="th-${mode_tag}-${section_tag}"
  local out_dir="${ROOT_DIR}/output/playwright/theme/${mode}/${section}"
  local capture_path="${out_dir}/capture-$(date +%Y%m%d%H%M%S)-${mode}-${section}.png"
  mkdir -p "${out_dir}"

  (
    cd "${out_dir}"
    "${PWCLI}" --session "${session}" open "${BASE_URL}/dashboard/#section-${section}"
    pw_run_js "${session}" "await page.evaluate((mode) => { localStorage.setItem('omac-theme-mode', mode); document.documentElement.setAttribute('data-theme-mode', mode); location.reload(); }, '${mode}');"
    pw_run_js "${session}" "await page.waitForTimeout(1200);"
    pw_run_js "${session}" "await page.screenshot({ path: '${capture_path}', scale: 'css', type: 'png' });"
    "${PWCLI}" --session "${session}" close
  )

  if [[ ! -f "${capture_path}" ]]; then
    echo "theme regression capture missing: ${mode}/${section}" >&2
    return 1
  fi
}

for mode in system light dark; do
  for section in status intake jobs audit; do
    capture_theme_section "${mode}" "${section}"
  done
done

echo "theme regression capture completed"
