#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
OWNER_ID="${OWNER_ID:-local-owner}"

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

wait_for_job_status() {
  local job_id="$1"
  local expected="$2"
  local timeout_sec="${3:-90}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    local status
    status="$(json_get '/api/jobs' | python3 -c 'import json,sys; job_id=sys.argv[1]; data=json.load(sys.stdin); job=next((j for j in data.get("jobs", []) if str(j.get("id"))==job_id), None); print(job.get("status","") if job else "")' "$job_id")"
    if [[ "${status}" == "${expected}" ]]; then
      return 0
    fi
    if [[ "${status}" == "failed" ]]; then
      echo "job ${job_id} failed while waiting for ${expected}" >&2
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "timeout waiting for job ${job_id} -> ${expected}" >&2
  return 1
}

echo "[smoke] ensuring server health..."
bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null
json_get "/api/health" >/dev/null

echo "[smoke] validating dashboard core sections..."
DASHBOARD_HTML="$(curl -fsS "${BASE_URL}/dashboard/")"
for token in "section-requests" "section-intake" "section-status" "section-jobs" "section-audit" "opsQueueBoard"; do
  if ! grep -q "${token}" <<< "${DASHBOARD_HTML}"; then
    echo "dashboard token missing: ${token}" >&2
    exit 1
  fi
done

echo "[smoke] loading target repository..."
REPO_PATH="$(json_get '/api/repos' | python3 -c 'import json,sys; repos=json.load(sys.stdin).get("repositories", []); print(repos[0]["path"] if repos else "")')"
if [[ -z "${REPO_PATH}" ]]; then
  echo "no allowed repositories found from /api/repos" >&2
  exit 1
fi

echo "[smoke] creating request..."
NOW_TAG="$(date +%Y%m%d%H%M%S)"
REQUEST_JSON="$(json_post '/api/requests' "{\"owner_id\":\"${OWNER_ID}\",\"client_name\":\"smoke-client\",\"raw_request\":\"smoke request ${NOW_TAG}\"}")"
REQUEST_ID="$(printf '%s' "${REQUEST_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("request", {}).get("id", ""))')"
if [[ -z "${REQUEST_ID}" ]]; then
  echo "failed to create request" >&2
  exit 1
fi

echo "[smoke] assigning job with manual_pre approval..."
ASSIGN_PAYLOAD="{\"owner_id\":\"${OWNER_ID}\",\"request_id\":\"${REQUEST_ID}\",\"work_type\":\"smoke\",\"mission\":\"smoke pipeline check\",\"repository\":\"${REPO_PATH}\",\"priority\":\"low\",\"refined_request\":\"[요약] smoke test\\n1. API path health\\n2. approval flow\\n3. audit evidence\",\"apply_changes\":false,\"approval_mode\":\"manual_pre\"}"
JOB_JSON="$(json_post '/api/jobs/from-request' "${ASSIGN_PAYLOAD}")"
JOB_ID="$(printf '%s' "${JOB_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("job", {}).get("id", ""))')"
if [[ -z "${JOB_ID}" ]]; then
  echo "failed to assign job" >&2
  exit 1
fi

echo "[smoke] waiting for pre-approval state..."
wait_for_job_status "${JOB_ID}" "waiting_pre_approval" 120

echo "[smoke] approving pre-change gate..."
json_post '/api/jobs/approve' "{\"owner_id\":\"${OWNER_ID}\",\"job_id\":\"${JOB_ID}\",\"phase\":\"pre\"}" >/dev/null

echo "[smoke] waiting for completion..."
wait_for_job_status "${JOB_ID}" "done" 120

echo "[smoke] validating audit events..."
json_get '/api/audit' | python3 -c 'import json,sys; job_id=sys.argv[1]; events=json.load(sys.stdin).get("events", []); found={"job_assigned":False,"job_approved":False,"job_done":False}; [found.__setitem__(e.get("kind"), True) for e in events if str(e.get("job_id") or "")==job_id and e.get("kind") in found]; missing=[k for k,v in found.items() if not v]; (print("ok") if not missing else (_ for _ in ()).throw(SystemExit("missing audit events: "+", ".join(missing))))' "$JOB_ID" >/dev/null

echo "[smoke] validating ops queue API..."
json_get '/api/ops/queue' | python3 -c 'import json,sys; data=json.load(sys.stdin); queue=data.get("queue") or {}; req={"counts","backlog","in_progress","failed"}; missing=[k for k in req if k not in queue]; (print("ok") if data.get("ok") and not missing else (_ for _ in ()).throw(SystemExit("ops queue snapshot invalid")))' >/dev/null
json_post '/api/ops/queue/manage' "{\"owner_id\":\"${OWNER_ID}\",\"action\":\"recover_stalled\"}" | python3 -c 'import json,sys; (print("ok") if json.load(sys.stdin).get("ok") else (_ for _ in ()).throw(SystemExit("recover_stalled action failed")))' >/dev/null

echo "[smoke] success: assignment/approval/audit/ops queue checks passed (job=${JOB_ID})"
