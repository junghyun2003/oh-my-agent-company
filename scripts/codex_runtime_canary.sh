#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${CODEX_CANARY_MODEL:-gpt-5-codex}"
REASONING_EFFORT="${CODEX_REASONING_EFFORT:-high}"
PROMPT="${CODEX_CANARY_PROMPT:-Respond with OK only. Do not run any shell commands.}"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex runtime canary failed: codex binary not found on PATH" >&2
  exit 1
fi

if [[ ! "${REASONING_EFFORT}" =~ ^(low|medium|high)$ ]]; then
  echo "codex runtime canary failed: CODEX_REASONING_EFFORT must be low|medium|high" >&2
  exit 1
fi

TMP_OUT="$(mktemp)"
trap 'rm -f "${TMP_OUT}"' EXIT

if ! codex exec \
  --ephemeral \
  -s read-only \
  -C "${ROOT_DIR}" \
  --skip-git-repo-check \
  -m "${MODEL}" \
  -c "model_reasoning_effort=\"${REASONING_EFFORT}\"" \
  "${PROMPT}" >"${TMP_OUT}" 2>&1; then
  echo "codex runtime canary failed" >&2
  tail -n 40 "${TMP_OUT}" >&2 || true
  exit 1
fi

if ! grep -q '^OK$' "${TMP_OUT}"; then
  echo "codex runtime canary failed: expected final OK response" >&2
  tail -n 40 "${TMP_OUT}" >&2 || true
  exit 1
fi

echo "codex_runtime_canary=ok"
