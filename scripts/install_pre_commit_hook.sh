#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_PATH="${ROOT_DIR}/.git/hooks/pre-commit"

if [[ ! -d "${ROOT_DIR}/.git/hooks" ]]; then
  echo "git hooks directory not found" >&2
  exit 1
fi

cat > "${HOOK_PATH}" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "${ROOT_DIR}"

python3 ./scripts/docs_sync_check.py
python3 -m py_compile scripts/todo_workflow.py
HOOK

chmod +x "${HOOK_PATH}"
echo "installed pre-commit hook: ${HOOK_PATH}"
