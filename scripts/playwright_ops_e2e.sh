#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
OWNER_ID="${OWNER_ID:-local-owner}"
STRICT_PLAYWRIGHT_E2E="${STRICT_PLAYWRIGHT_E2E:-1}"
OUTPUT_DIR="${ROOT_DIR}/output/playwright/ops-e2e"
SESSION="omc-ops-e2e"

# shellcheck source=/dev/null
source "${ROOT_DIR}/scripts/playwright_common.sh"

ensure_playwright_ready "${STRICT_PLAYWRIGHT_E2E}" || {
  rc=$?
  if [[ "${rc}" -eq 2 ]]; then
    echo "playwright ops e2e skipped"
    exit 0
  fi
  exit "${rc}"
}

mkdir -p "${OUTPUT_DIR}"

json_get() {
  local path="$1"
  curl -fsS "${BASE_URL}${path}"
}

find_request_id_by_client() {
  local client_name="$1"
  json_get '/api/requests?limit=500&offset=0' | python3 -c 'import json,sys; client=sys.argv[1]; rows=json.load(sys.stdin).get("requests", []); match=next((r for r in rows if r.get("client_name")==client), None); print(match.get("id","") if match else "")' "${client_name}"
}

wait_for_request_id_by_client() {
  local client_name="$1"
  local timeout_sec="${2:-30}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    local request_id
    request_id="$(find_request_id_by_client "${client_name}")"
    if [[ -n "${request_id}" ]]; then
      printf '%s\n' "${request_id}"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

find_job_id_by_request() {
  local request_id="$1"
  json_get '/api/jobs?limit=500&offset=0' | python3 -c 'import json,sys; request_id=sys.argv[1]; rows=json.load(sys.stdin).get("jobs", []); match=next((j for j in rows if j.get("request_id")==request_id), None); print(match.get("id","") if match else "")' "${request_id}"
}

wait_for_job_id_by_request() {
  local request_id="$1"
  local timeout_sec="${2:-30}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    local job_id
    job_id="$(find_job_id_by_request "${request_id}")"
    if [[ -n "${job_id}" ]]; then
      printf '%s\n' "${job_id}"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

wait_for_job_status() {
  local job_id="$1"
  local expected="$2"
  local timeout_sec="${3:-120}"
  local elapsed=0
  while [[ "${elapsed}" -lt "${timeout_sec}" ]]; do
    local status
    status="$(json_get '/api/jobs?limit=500&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("jobs", []); match=next((j for j in rows if j.get("id")==job_id), None); print(match.get("status","") if match else "")' "${job_id}")"
    if [[ "${status}" == "${expected}" ]]; then
      return 0
    fi
    if [[ "${status}" == "failed" ]]; then
      echo "job ${job_id} failed while waiting for ${expected}" >&2
      json_get '/api/jobs?limit=500&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("jobs", []); match=next((j for j in rows if j.get("id")==job_id), None); print(json.dumps(match.get("error"), ensure_ascii=False, indent=2) if match else "job missing")' "${job_id}" >&2
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "timeout waiting for job ${job_id} -> ${expected}" >&2
  return 1
}

assert_post_job_audit() {
  local job_id="$1"
  json_get '/api/audit?limit=500&offset=0' | python3 -c 'import json,sys; job_id=sys.argv[1]; rows=json.load(sys.stdin).get("events", []); ok=any(str(e.get("job_id") or "")==job_id and e.get("kind")=="post_job_audit" for e in rows); print("ok" if ok else (_ for _ in ()).throw(SystemExit(f"missing post_job_audit for {job_id}")))' "${job_id}" >/dev/null
}

pw() {
  "${PWCLI}" --session "${SESSION}" "$@"
}

run_js() {
  local body="$1"
  pw run-code "$(printf 'async (page) => {\n%s\n}\n' "${body}")"
}

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null

pw open "${BASE_URL}/dashboard/"
run_js 'await page.setViewportSize({ width: 1440, height: 1280 }); await page.waitForTimeout(1200);'

AUTO_NONCE="pw-auto-$(date +%s)-$RANDOM"
AUTO_CLIENT="PW Auto ${AUTO_NONCE}"
AUTO_RAW="Playwright auto flow ${AUTO_NONCE}"

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-requests");
await page.waitForTimeout(700);
await page.locator("#requestClientName").fill("${AUTO_CLIENT}");
await page.locator("#requestRawInput").fill("${AUTO_RAW}");
await page.locator("#requestForm button[type='submit']").click();
await page.waitForFunction(() => /요청 접수 완료:\s*req-/.test(document.querySelector("#requestSubmitResult")?.textContent || ""), null, { timeout: 15000 });
return await page.locator("#requestSubmitResult").textContent();
EOF
)" >/dev/null

AUTO_REQUEST_ID="$(wait_for_request_id_by_client "${AUTO_CLIENT}" 30 || true)"
if [[ -z "${AUTO_REQUEST_ID}" ]]; then
  echo "playwright ops e2e failed: auto-flow request not found" >&2
  exit 1
fi

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-intake");
await page.waitForTimeout(700);
await page.waitForFunction(() => {
  const req = document.querySelector("#requestSelect");
  const repo = document.querySelector("#repoSelect");
  return !!req && req.options.length > 1 && !!repo && repo.options.length > 1;
}, null, { timeout: 15000 });
await page.locator("#requestSelect").selectOption("${AUTO_REQUEST_ID}");
if (!(await page.locator("#repoSelect").inputValue())) {
  await page.locator("#repoSelect").selectOption({ index: 1 });
}
await page.evaluate(() => {
  const approvalMode = document.getElementById("approvalMode");
  if (!approvalMode) throw new Error("approvalMode control missing");
  approvalMode.value = "auto";
  approvalMode.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#workTypeInput").fill("Playwright Auto Flow");
await page.locator("#missionInput").fill("Playwright auto approval validation ${AUTO_NONCE}");
await page.locator("#jobPriority").selectOption("normal");
await page.locator("#refinedRequestInput").fill("[요약] Playwright auto approval validation\\n1. apply_changes=false\\n2. done/report 확인\\n3. post_job_audit 확인");
await page.locator("#applyChanges").uncheck();
await page.locator("#jobForm button[type='submit']").click();
await page.waitForFunction(() => /작업 할당 완료:\s*job-/.test(document.querySelector("#jobSubmitResult")?.textContent || ""), null, { timeout: 15000 });
return await page.locator("#jobSubmitResult").textContent();
EOF
)" >/dev/null

AUTO_JOB_ID="$(wait_for_job_id_by_request "${AUTO_REQUEST_ID}" 30 || true)"
if [[ -z "${AUTO_JOB_ID}" ]]; then
  echo "playwright ops e2e failed: auto-flow job not found" >&2
  exit 1
fi

wait_for_job_status "${AUTO_JOB_ID}" "done" 120
assert_post_job_audit "${AUTO_JOB_ID}"

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-jobs");
await page.waitForTimeout(800);
await page.waitForFunction((jobId) => {
  const table = document.querySelector("#jobsTable");
  return !!table && table.innerText.includes(jobId);
}, "${AUTO_JOB_ID}", { timeout: 15000 });
await page.waitForFunction((jobId) => {
  const rows = Array.from(document.querySelectorAll("#jobsTable tbody tr"));
  const row = rows.find((item) => item.innerText.includes(jobId));
  return !!row && !!row.querySelector("a[href]");
}, "${AUTO_JOB_ID}", { timeout: 15000 });
await page.goto("${BASE_URL}/dashboard/#section-audit");
await page.waitForTimeout(800);
await page.locator("#auditJobIdInput").fill("${AUTO_JOB_ID}");
await page.waitForTimeout(900);
await page.waitForFunction((jobId) => {
  const auditTable = document.querySelector("#auditTable");
  return !!auditTable && auditTable.innerText.includes(jobId) && auditTable.innerText.includes("post_job_audit");
}, "${AUTO_JOB_ID}", { timeout: 15000 });
return "auto-flow-ok";
EOF
)" >/dev/null

( cd "${OUTPUT_DIR}" && pw screenshot >/dev/null )

MANUAL_NONCE="pw-manual-$(date +%s)-$RANDOM"
MANUAL_CLIENT="PW Manual ${MANUAL_NONCE}"
MANUAL_RAW="Playwright manual-pre flow ${MANUAL_NONCE}"

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-requests");
await page.waitForTimeout(700);
await page.locator("#requestClientName").fill("${MANUAL_CLIENT}");
await page.locator("#requestRawInput").fill("${MANUAL_RAW}");
await page.locator("#requestForm button[type='submit']").click();
await page.waitForFunction(() => /요청 접수 완료:\s*req-/.test(document.querySelector("#requestSubmitResult")?.textContent || ""), null, { timeout: 15000 });
return await page.locator("#requestSubmitResult").textContent();
EOF
)" >/dev/null

MANUAL_REQUEST_ID="$(wait_for_request_id_by_client "${MANUAL_CLIENT}" 30 || true)"
if [[ -z "${MANUAL_REQUEST_ID}" ]]; then
  echo "playwright ops e2e failed: manual-pre request not found" >&2
  exit 1
fi

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-intake");
await page.waitForTimeout(700);
await page.waitForFunction(() => {
  const req = document.querySelector("#requestSelect");
  const repo = document.querySelector("#repoSelect");
  return !!req && req.options.length > 1 && !!repo && repo.options.length > 1;
}, null, { timeout: 15000 });
await page.locator("#requestSelect").selectOption("${MANUAL_REQUEST_ID}");
if (!(await page.locator("#repoSelect").inputValue())) {
  await page.locator("#repoSelect").selectOption({ index: 1 });
}
await page.evaluate(() => {
  const approvalMode = document.getElementById("approvalMode");
  if (!approvalMode) throw new Error("approvalMode control missing");
  approvalMode.value = "manual_pre";
  approvalMode.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#workTypeInput").fill("Playwright Manual Pre");
await page.locator("#missionInput").fill("Playwright manual pre validation ${MANUAL_NONCE}");
await page.locator("#jobPriority").selectOption("normal");
await page.locator("#refinedRequestInput").fill("[요약] Playwright manual pre validation\\n1. waiting_pre_approval 진입\\n2. 승인 UI 조작\\n3. done/post_job_audit 확인");
await page.locator("#applyChanges").uncheck();
await page.locator("#jobForm button[type='submit']").click();
await page.waitForFunction(() => /작업 할당 완료:\s*job-/.test(document.querySelector("#jobSubmitResult")?.textContent || ""), null, { timeout: 15000 });
return await page.locator("#jobSubmitResult").textContent();
EOF
)" >/dev/null

MANUAL_JOB_ID="$(wait_for_job_id_by_request "${MANUAL_REQUEST_ID}" 30 || true)"
if [[ -z "${MANUAL_JOB_ID}" ]]; then
  echo "playwright ops e2e failed: manual-pre job not found" >&2
  exit 1
fi

wait_for_job_status "${MANUAL_JOB_ID}" "waiting_pre_approval" 120

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-jobs");
await page.waitForTimeout(800);
await page.waitForFunction((jobId) => {
  const select = document.querySelector("#approveJobSelect");
  return !!select && Array.from(select.options).some((opt) => opt.value === jobId);
}, "${MANUAL_JOB_ID}", { timeout: 15000 });
await page.locator("#approveJobSelect").selectOption("${MANUAL_JOB_ID}");
await page.locator("#approvePhase").selectOption("pre");
await page.locator("#approveForm button[type='submit']").click();
await page.waitForFunction(() => /승인 처리 완료/.test(document.querySelector("#approveResult")?.textContent || ""), null, { timeout: 15000 });
return await page.locator("#approveResult").textContent();
EOF
)" >/dev/null

wait_for_job_status "${MANUAL_JOB_ID}" "done" 120
assert_post_job_audit "${MANUAL_JOB_ID}"

run_js "$(cat <<EOF
await page.goto("${BASE_URL}/dashboard/#section-audit");
await page.waitForTimeout(800);
await page.locator("#auditJobIdInput").fill("${MANUAL_JOB_ID}");
await page.waitForTimeout(900);
await page.waitForFunction((jobId) => {
  const auditTable = document.querySelector("#auditTable");
  return !!auditTable && auditTable.innerText.includes(jobId) && auditTable.innerText.includes("post_job_audit");
}, "${MANUAL_JOB_ID}", { timeout: 15000 });
return "manual-flow-ok";
EOF
)" >/dev/null

( cd "${OUTPUT_DIR}" && pw screenshot >/dev/null )
pw close >/dev/null || true

echo "playwright_ops_e2e=ok auto_job=${AUTO_JOB_ID} manual_job=${MANUAL_JOB_ID}"
