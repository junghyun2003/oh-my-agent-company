#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

TEAM="${1:-all}"
LIMIT="${2:-40}"

if ! [[ "${LIMIT}" =~ ^[0-9]+$ ]]; then
  echo "오류: 두 번째 인자는 숫자여야 합니다. (예: 40)"
  exit 1
fi

case "${TEAM}" in
  ceo|cto|pm|product|backend|frontend|app|design|security|qa|infra|marketing|strategy|tech-lead)
    SCOPE="${TEAM}"
    ;;
  all)
    git log --oneline --decorate -n "${LIMIT}"
    exit 0
    ;;
  *)
    echo "사용법: ./scripts/team_commit_log.sh <team|all> [개수]"
    echo "팀 코드: ceo cto pm product backend frontend app design security qa infra marketing strategy tech-lead all"
    exit 1
    ;;
esac

PATTERN="^[a-z]+\\(${SCOPE}\\):"

OUT="$(git log \
  --oneline \
  --decorate \
  --perl-regexp \
  --grep "${PATTERN}" \
  -n "${LIMIT}" || true)"

if [[ -z "${OUT}" ]]; then
  echo "[안내] ${TEAM} 팀 scope 커밋이 없습니다."
  echo "형식 예시: feat(${TEAM}): 요약"
  exit 0
fi

echo "${OUT}"
