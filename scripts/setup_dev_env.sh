#!/usr/bin/env bash
set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=1
fi

status_ok=1

check_cmd() {
  local name="$1"
  if command -v "${name}" >/dev/null 2>&1; then
    echo "[ok] ${name}: $(command -v "${name}")"
  else
    echo "[missing] ${name}"
    status_ok=0
  fi
}

echo "== local dev environment check =="
check_cmd python3
check_cmd bash
check_cmd curl
check_cmd git
check_cmd codex
check_cmd node
check_cmd npm
check_cmd npx

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${CODEX_HOME}/skills/playwright/scripts/playwright_cli.sh"
if [[ -x "${PWCLI}" ]]; then
  echo "[ok] playwright wrapper: ${PWCLI}"
else
  echo "[missing] playwright wrapper: ${PWCLI}"
  status_ok=0
fi

if [[ "${CHECK_ONLY}" == "1" ]]; then
  [[ "${status_ok}" -eq 1 ]] && echo "env_check=ok" || echo "env_check=warn"
  exit 0
fi

if [[ "${status_ok}" -ne 1 ]]; then
  cat <<'EOM'
Some prerequisites are missing.
Install guide:
- codex --version
- node --version
- npm --version
- npm install -g @playwright/cli@latest
EOM
fi

exit 0
