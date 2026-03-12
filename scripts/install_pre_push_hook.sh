#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_PATH="${ROOT_DIR}/.git/hooks/pre-push"

if [[ ! -d "${ROOT_DIR}/.git/hooks" ]]; then
  echo "git hooks directory not found. run inside repository root." >&2
  exit 1
fi

cat > "${HOOK_PATH}" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "${ROOT_DIR}"

python3 ./scripts/docs_sync_check.py
python3 ./scripts/team_policy_check.py
python3 ./scripts/language_policy_check.py
bash ./scripts/smoke_core_flows.sh
HOOK

chmod +x "${HOOK_PATH}"
echo "installed pre-push hook: ${HOOK_PATH}"
