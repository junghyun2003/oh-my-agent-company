#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

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
git log --oneline "${BASE}..HEAD" || true
echo

echo "[Diff stat since baseline]"
git diff --stat "${BASE}..HEAD" || true

