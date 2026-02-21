#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm이 설치되어 있지 않습니다."
  echo "Node.js/npm 설치 후 다시 실행하세요."
  echo "확인 명령: node --version && npm --version"
  exit 1
fi

echo "[1/3] npm 버전 확인"
npm --version

echo "[2/3] 로컬 npm 설치 실행"
npm install --no-audit --no-fund

echo "[3/3] 서버 상태 확인"
bash ./scripts/infra_server_ctl.sh ensure
bash ./scripts/infra_server_ctl.sh status

echo "완료: npm 기반 로컬 설치/실행 준비가 끝났습니다."
