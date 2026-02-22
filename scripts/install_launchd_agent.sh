#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.oh-my-agent-company.orchestrator"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

mkdir -p "${PLIST_DIR}"

PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || true)}"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "python3 not found" >&2
  exit 1
fi

PORT="${ORCHESTRATOR_PORT:-18765}"
LOG_OUT="${ROOT_DIR}/state/launchd.out.log"
LOG_ERR="${ROOT_DIR}/state/launchd.err.log"
SCRIPT="${ROOT_DIR}/scripts/orchestrator_server.py"

cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${PYTHON_BIN}</string>
      <string>${SCRIPT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${ROOT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>ORCHESTRATOR_PORT</key>
      <string>${PORT}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_OUT}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_ERR}</string>
  </dict>
</plist>
PLIST

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  echo "plist=${PLIST_PATH}"
  echo "label=${LABEL}"
  exit 0
fi

launchctl unload "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl load "${PLIST_PATH}"
launchctl start "${LABEL}" || true

echo "installed_launchd_agent=${LABEL}"
echo "plist=${PLIST_PATH}"
