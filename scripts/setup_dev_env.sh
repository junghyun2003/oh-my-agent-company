#!/usr/bin/env bash
set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=1
fi

core_ok=1
advanced_ok=1

find_node_tool() {
  local name="$1"
  if command -v "${name}" >/dev/null 2>&1; then
    command -v "${name}"
    return 0
  fi
  if [[ -n "${NVM_BIN:-}" && -x "${NVM_BIN}/${name}" ]]; then
    echo "${NVM_BIN}/${name}"
    return 0
  fi
  local candidates=("${HOME}"/.nvm/versions/node/*/bin/"${name}")
  local idx
  for (( idx=${#candidates[@]}-1; idx>=0; idx-- )); do
    if [[ -x "${candidates[idx]}" ]]; then
      echo "${candidates[idx]}"
      return 0
    fi
  done
  return 1
}

check_core_cmd() {
  local name="$1"
  if command -v "${name}" >/dev/null 2>&1; then
    echo "[ok] ${name}: $(command -v "${name}")"
  else
    echo "[missing] ${name}"
    core_ok=0
  fi
}

check_optional_cmd() {
  local name="$1"
  local path=""
  if [[ "${name}" == "node" || "${name}" == "npm" || "${name}" == "npx" ]]; then
    path="$(find_node_tool "${name}" || true)"
  elif command -v "${name}" >/dev/null 2>&1; then
    path="$(command -v "${name}")"
  fi

  if [[ -n "${path}" ]]; then
    echo "[ok] ${name}: ${path}"
  else
    echo "[optional-missing] ${name}"
    advanced_ok=0
  fi
}

echo "== local dev environment check =="
echo "-- core required (first run) --"
check_core_cmd python3
check_core_cmd bash
check_core_cmd curl
check_core_cmd git
check_core_cmd codex

echo "-- advanced optional (npm / playwright / github automation) --"
check_optional_cmd node
check_optional_cmd npm
check_optional_cmd npx
check_optional_cmd gh

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${CODEX_HOME}/skills/playwright/scripts/playwright_cli.sh"
if [[ -x "${PWCLI}" ]]; then
  echo "[ok] playwright wrapper: ${PWCLI}"
else
  echo "[optional-missing] playwright wrapper: ${PWCLI}"
  advanced_ok=0
fi

if [[ "${CHECK_ONLY}" == "1" ]]; then
  [[ "${core_ok}" -eq 1 ]] && echo "core_required=ok" || echo "core_required=warn"
  [[ "${advanced_ok}" -eq 1 ]] && echo "advanced_optional=ok" || echo "advanced_optional=warn"
  [[ "${core_ok}" -eq 1 ]] && echo "env_check=ok" || echo "env_check=warn"
  exit 0
fi

if [[ "${core_ok}" -ne 1 ]]; then
  cat <<'EOM'
Some core prerequisites are missing.
Install guide:
- codex --version
EOM
fi

if [[ "${advanced_ok}" -ne 1 ]]; then
  cat <<'EOM'
Advanced local automation is not fully ready yet.
You can still boot the server and use the dashboard, but npm / Playwright / GitHub PR automation may be unavailable.

Optional setup guide:
- node --version
- npm --version
- npm install -g @playwright/cli@latest
- gh --version
EOM
fi

exit 0
