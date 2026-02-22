#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SAVE_MODE=0
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --save)
      SAVE_MODE=1
      shift
      ;;
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "usage: $0 [--save] [--output <path>]" >&2
      exit 2
      ;;
  esac
done

BASE_ENV="${ROOT_DIR}/UPSTREAM_BASELINE.env"
if [[ ! -f "${BASE_ENV}" ]]; then
  echo "missing: ${BASE_ENV}"
  exit 1
fi

# shellcheck disable=SC1090
source "${BASE_ENV}"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
UPSTREAM_REF="${UPSTREAM_REF:-}"
LAST_SYNC_AT="${LAST_SYNC_AT:-}"

echo "[Fork Diff Report]"
echo "upstream_remote=${UPSTREAM_REMOTE}"
echo "upstream_branch=${UPSTREAM_BRANCH}"
echo "upstream_ref=${UPSTREAM_REF:-<empty>}"
echo "last_sync_at=${LAST_SYNC_AT:-<empty>}"
echo

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "not a git repository"
  exit 1
fi

BASE=""
if [[ -n "${UPSTREAM_REF}" ]]; then
  BASE="${UPSTREAM_REF}"
else
  if git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
    git fetch "${UPSTREAM_REMOTE}" "${UPSTREAM_BRANCH}" --quiet || true
    BASE="$(git merge-base HEAD "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}" 2>/dev/null || true)"
  fi
fi

if [[ -z "${BASE}" ]]; then
  echo "cannot determine baseline."
  echo "set UPSTREAM_REF in UPSTREAM_BASELINE.env (tag or commit SHA)."
  exit 1
fi

echo "resolved_baseline=${BASE}"
echo

echo "[Commits since baseline]"
COMMITS="$(git log --oneline "${BASE}..HEAD" || true)"
if [[ -n "${COMMITS}" ]]; then
  echo "${COMMITS}"
else
  echo "<none>"
fi
echo

echo "[Diff stat since baseline]"
DIFF_STAT="$(git diff --stat "${BASE}..HEAD" || true)"
if [[ -n "${DIFF_STAT}" ]]; then
  echo "${DIFF_STAT}"
else
  echo "<none>"
fi

if [[ "${SAVE_MODE}" -eq 1 ]]; then
  if [[ -z "${OUTPUT_FILE}" ]]; then
    mkdir -p "${ROOT_DIR}/reports/fork"
    OUTPUT_FILE="${ROOT_DIR}/reports/fork/customization-report-$(date -u +%Y%m%dT%H%M%SZ).md"
  fi
  mkdir -p "$(dirname "${OUTPUT_FILE}")"
  {
    echo "# Fork Customization Report"
    echo
    echo "- generated_at_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "- upstream_remote: ${UPSTREAM_REMOTE}"
    echo "- upstream_branch: ${UPSTREAM_BRANCH}"
    echo "- upstream_ref: ${UPSTREAM_REF:-<empty>}"
    echo "- last_sync_at: ${LAST_SYNC_AT:-<empty>}"
    echo "- resolved_baseline: ${BASE}"
    echo
    echo "## Commits Since Baseline"
    if [[ -n "${COMMITS}" ]]; then
      echo '```text'
      echo "${COMMITS}"
      echo '```'
    else
      echo "- none"
    fi
    echo
    echo "## Diff Stat Since Baseline"
    if [[ -n "${DIFF_STAT}" ]]; then
      echo '```text'
      echo "${DIFF_STAT}"
      echo '```'
    else
      echo "- none"
    fi
  } > "${OUTPUT_FILE}"
  echo
  echo "saved_report=${OUTPUT_FILE}"
fi
