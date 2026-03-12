#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
OWNER_ID="${OWNER_ID:-local-owner}"
DB_PATH="${ROOT_DIR}/state/agent_company.db"

json_get() {
  local path="$1"
  curl -fsS "${BASE_URL}${path}"
}

json_post() {
  local path="$1"
  local payload="$2"
  curl -fsS -X POST "${BASE_URL}${path}" \
    -H 'Content-Type: application/json' \
    -d "${payload}"
}

wait_for_health() {
  local timeout_sec="${1:-45}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "timeout waiting for health" >&2
  return 1
}

wait_for_job_status() {
  local job_id="$1"
  local expected="$2"
  local timeout_sec="${3:-120}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    local status
    status="$(json_get '/api/jobs?limit=500&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("jobs", []); match=next((j for j in rows if str(j.get("id"))==job_id), None); print(match.get("status","") if match else "")' "${job_id}")"
    if [[ "${status}" == "${expected}" ]]; then
      return 0
    fi
    if [[ "${status}" == "failed" && "${expected}" != "failed" ]]; then
      echo "job ${job_id} failed while waiting for ${expected}" >&2
      json_get '/api/jobs?limit=500&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("jobs", []); match=next((j for j in rows if str(j.get("id"))==job_id), None); print(json.dumps(match.get("error"), ensure_ascii=False, indent=2) if match else "job missing")' "${job_id}" >&2
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "timeout waiting for job ${job_id} -> ${expected}" >&2
  return 1
}

assert_audit_recovery() {
  local job_id="$1"
  local reason="$2"
  local action="$3"
  json_get '/api/audit?limit=1000&offset=0' | python3 -c 'import json,sys; job_id,reason,action=sys.argv[1:4]; rows=json.load(sys.stdin).get("events", []); ok=any(str(e.get("job_id") or "")==job_id and e.get("kind")=="job_stalled_recovered" and (e.get("detail") or {}).get("reason")==reason and (e.get("detail") or {}).get("recovery_action")==action for e in rows); print("ok" if ok else (_ for _ in ()).throw(SystemExit(f"missing recovery audit for {job_id}: {reason}/{action}")))' "${job_id}" "${reason}" "${action}" >/dev/null
}

assert_post_job_audit() {
  local job_id="$1"
  json_get '/api/audit?limit=1000&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("events", []); ok=any(str(e.get("job_id") or "")==job_id and e.get("kind")=="post_job_audit" for e in rows); print("ok" if ok else (_ for _ in ()).throw(SystemExit(f"missing post_job_audit for {job_id}")))' "${job_id}" >/dev/null
}

create_request() {
  local client_name="$1"
  local raw_request="$2"
  json_post '/api/requests' "{\"owner_id\":\"${OWNER_ID}\",\"client_name\":\"${client_name}\",\"raw_request\":\"${raw_request}\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("request", {}).get("id", ""))'
}

repo_path() {
  json_get '/api/repos' | python3 -c 'import json,sys; rows=json.load(sys.stdin).get("repositories", []); print(rows[0]["path"] if rows else "")'
}

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null
wait_for_health 30

REPO_PATH="$(repo_path)"
if [[ -z "${REPO_PATH}" ]]; then
  echo "no repository available for runtime recovery smoke" >&2
  exit 1
fi

DISPATCH_NONCE="dispatch-recovery-$(date +%s)-$RANDOM"
DISPATCH_REQUEST_ID="$(create_request "Recovery Dispatch ${DISPATCH_NONCE}" "Synthetic dispatching recovery ${DISPATCH_NONCE}")"
if [[ -z "${DISPATCH_REQUEST_ID}" ]]; then
  echo "failed to create dispatch recovery request" >&2
  exit 1
fi

DISPATCH_JOB_ID="job-runtime-recovery-${DISPATCH_NONCE}"
python3 - <<'PY' "${DB_PATH}" "${DISPATCH_REQUEST_ID}" "${DISPATCH_JOB_ID}" "${REPO_PATH}"
import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

db_path, request_id, job_id, repo_path = sys.argv[1:5]
now = datetime.now(timezone.utc).replace(microsecond=0)
created_at = (now - timedelta(minutes=11)).isoformat().replace("+00:00", "Z")
timeline = json.dumps([{"at": created_at, "message": "Synthetic dispatching orphan for runtime recovery smoke."}], ensure_ascii=False)

con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute(
    """
    INSERT INTO jobs (
      id, owner_id, request_id, client_name, work_type, mission, repository, refined_request,
      apply_changes, approval_mode, priority, status, stage, created_at, dispatched_at, timeline,
      executed_actions, changed_files, pm_notes, cto_notes, dev_notes, qa_notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """,
    (
        job_id,
        "local-owner",
        request_id,
        f"Recovery Dispatch {job_id}",
        "runtime-recovery",
        "dispatching recovery smoke",
        repo_path,
        "[요약] Synthetic dispatching recovery smoke\n1. dispatching timeout 복구\n2. same job requeue\n3. done 확인",
        0,
        "auto",
        "normal",
        "dispatching",
        "dispatch",
        created_at,
        created_at,
        timeline,
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
    ),
)
cur.execute(
    "UPDATE requests SET status='in_company', linked_job_id=?, assigned_at=? WHERE id=?",
    (job_id, created_at, request_id),
)
con.commit()
con.close()
PY

json_post '/api/ops/queue/manage' "{\"owner_id\":\"${OWNER_ID}\",\"action\":\"recover_stalled\"}" >/dev/null
wait_for_job_status "${DISPATCH_JOB_ID}" "done" 120
assert_audit_recovery "${DISPATCH_JOB_ID}" "dispatching_timeout_recovery" "requeued"
assert_post_job_audit "${DISPATCH_JOB_ID}"

RESTART_NONCE="restart-recovery-$(date +%s)-$RANDOM"
RESTART_REQUEST_ID="$(create_request "Recovery Restart ${RESTART_NONCE}" "Restart orphan recovery ${RESTART_NONCE}")"
if [[ -z "${RESTART_REQUEST_ID}" ]]; then
  echo "failed to create restart recovery request" >&2
  exit 1
fi

RESTART_ASSIGN_PAYLOAD="{\"owner_id\":\"${OWNER_ID}\",\"request_id\":\"${RESTART_REQUEST_ID}\",\"work_type\":\"runtime-recovery\",\"mission\":\"restart recovery smoke\",\"repository\":\"${REPO_PATH}\",\"priority\":\"normal\",\"refined_request\":\"[요약] Restart recovery smoke\\n1. manual_pre waiting state\\n2. restart reconciliation\\n3. post_job_audit 확인\",\"apply_changes\":false,\"approval_mode\":\"manual_pre\"}"
RESTART_JOB_ID="$(json_post '/api/jobs/from-request' "${RESTART_ASSIGN_PAYLOAD}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("job", {}).get("id", ""))')"
if [[ -z "${RESTART_JOB_ID}" ]]; then
  echo "failed to assign restart recovery job" >&2
  exit 1
fi

wait_for_job_status "${RESTART_JOB_ID}" "waiting_pre_approval" 120
bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" restart >/dev/null
wait_for_health 45
wait_for_job_status "${RESTART_JOB_ID}" "waiting_pre_approval" 120
assert_audit_recovery "${RESTART_JOB_ID}" "orchestrator_restart_recovery" "requeued"

json_post '/api/jobs/approve' "{\"owner_id\":\"${OWNER_ID}\",\"job_id\":\"${RESTART_JOB_ID}\",\"phase\":\"pre\"}" >/dev/null
wait_for_job_status "${RESTART_JOB_ID}" "done" 120
assert_post_job_audit "${RESTART_JOB_ID}"

echo "runtime_recovery_smoke=ok dispatch_job=${DISPATCH_JOB_ID} restart_job=${RESTART_JOB_ID}"
