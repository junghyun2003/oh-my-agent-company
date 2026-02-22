#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${ROOT_DIR}/state/agent_company.db"
BACKUP_DIR="${ROOT_DIR}/state/backups"
PORT="${ORCHESTRATOR_PORT:-18765}"

mkdir -p "${BACKUP_DIR}"

now_utc() {
  date -u +"%Y%m%dT%H%M%SZ"
}

usage() {
  echo "usage: $0 {backup|list|restore <backup_file>|prune [keep_count]}" >&2
}

backup_db() {
  local ts out
  ts="$(now_utc)"
  out="${BACKUP_DIR}/agent_company-${ts}.db"

  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${DB_PATH}" ".backup '${out}'"
  else
    cp "${DB_PATH}" "${out}"
  fi
  echo "backup_created=${out}"
}

list_backups() {
  ls -1t "${BACKUP_DIR}"/agent_company-*.db 2>/dev/null || true
}

restore_db() {
  local src="${1:-}"
  if [[ -z "${src}" ]]; then
    echo "restore target required" >&2
    return 1
  fi
  if [[ ! -f "${src}" ]]; then
    echo "backup file not found: ${src}" >&2
    return 1
  fi

  bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" stop >/dev/null || true
  cp "${src}" "${DB_PATH}"
  rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
  bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" start >/dev/null || true
  echo "restore_done=${src}"
}

prune_backups() {
  local keep="${1:-15}"
  if ! [[ "${keep}" =~ ^[0-9]+$ ]]; then
    echo "keep_count must be numeric" >&2
    return 1
  fi
  mapfile -t files < <(list_backups)
  local idx=0
  for f in "${files[@]}"; do
    idx=$((idx + 1))
    if [[ "${idx}" -le "${keep}" ]]; then
      continue
    fi
    rm -f "${f}"
  done
  echo "prune_done keep=${keep}"
}

case "${1:-}" in
  backup)
    backup_db
    ;;
  list)
    list_backups
    ;;
  restore)
    restore_db "${2:-}"
    ;;
  prune)
    prune_backups "${2:-15}"
    ;;
  *)
    usage
    exit 2
    ;;
esac
