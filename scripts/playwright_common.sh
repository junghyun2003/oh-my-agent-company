#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

candidate_runtime_bin_dirs() {
  local dirs=()

  if [[ -n "${NVM_BIN:-}" && -d "${NVM_BIN}" ]]; then
    dirs+=("${NVM_BIN}")
  fi

  if [[ -n "${VOLTA_HOME:-}" && -d "${VOLTA_HOME}/bin" ]]; then
    dirs+=("${VOLTA_HOME}/bin")
  fi

  if [[ -d "/opt/homebrew/bin" ]]; then
    dirs+=("/opt/homebrew/bin")
  fi

  if [[ -d "/usr/local/bin" ]]; then
    dirs+=("/usr/local/bin")
  fi

  local nvm_versions_dir="${HOME}/.nvm/versions/node"
  if [[ -d "${nvm_versions_dir}" ]]; then
    while IFS= read -r bin_dir; do
      [[ -n "${bin_dir}" ]] && dirs+=("${bin_dir}")
    done < <(find "${nvm_versions_dir}" -mindepth 2 -maxdepth 2 -type d -name bin | sort -r)
  fi

  printf '%s\n' "${dirs[@]}" | awk 'NF && !seen[$0]++'
}

ensure_runtime_tool_on_path() {
  local tool_name="$1"
  if command -v "${tool_name}" >/dev/null 2>&1; then
    return 0
  fi

  local dir candidate
  while IFS= read -r dir; do
    [[ -n "${dir}" ]] || continue
    candidate="${dir}/${tool_name}"
    if [[ -x "${candidate}" ]]; then
      export PATH="${dir}:${PATH}"
      return 0
    fi
  done < <(candidate_runtime_bin_dirs)

  return 1
}

playwright_prereq_help() {
  cat <<'EOM'
# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
EOM
}

ensure_playwright_ready() {
  local strict="${1:-0}"

  ensure_runtime_tool_on_path node >/dev/null 2>&1 || true
  ensure_runtime_tool_on_path npm >/dev/null 2>&1 || true

  if ! ensure_runtime_tool_on_path npx >/dev/null 2>&1; then
    echo "Playwright prerequisite missing: npx not found." >&2
    playwright_prereq_help >&2
    if [[ "${strict}" == "1" ]]; then
      return 1
    fi
    return 2
  fi

  if [[ ! -x "${PWCLI}" ]]; then
    echo "Playwright prerequisite missing: wrapper not found or not executable (${PWCLI})." >&2
    if [[ "${strict}" == "1" ]]; then
      return 1
    fi
    return 2
  fi

  return 0
}
