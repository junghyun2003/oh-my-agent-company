#!/usr/bin/env bash
set -euo pipefail

LABEL="com.oh-my-agent-company.orchestrator"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry_run=1"
  echo "plist=${PLIST_PATH}"
  echo "label=${LABEL}"
  exit 0
fi

if [[ -f "${PLIST_PATH}" ]]; then
  launchctl unload "${PLIST_PATH}" >/dev/null 2>&1 || true
  rm -f "${PLIST_PATH}"
fi

echo "uninstalled_launchd_agent=${LABEL}"
