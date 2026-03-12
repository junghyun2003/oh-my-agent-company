#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:${ORCHESTRATOR_PORT:-18765}}"
STRICT_PLAYWRIGHT_VISUAL="${STRICT_PLAYWRIGHT_VISUAL:-0}"
STRICT_VISUAL_BASELINE="${STRICT_VISUAL_BASELINE:-0}"
RESET_VISUAL_BASELINE="${RESET_VISUAL_BASELINE:-0}"

# shellcheck source=/dev/null
source "${ROOT_DIR}/scripts/playwright_common.sh"

mkdir -p "${ROOT_DIR}/output/playwright/current" "${ROOT_DIR}/output/playwright/baseline"

ensure_playwright_ready "${STRICT_PLAYWRIGHT_VISUAL}" || {
  rc=$?
  if [[ "${rc}" -eq 2 ]]; then
    echo "strict mode disabled: skipping visual regression"
    exit 0
  fi
  echo "strict mode enabled: missing Playwright prerequisite is treated as failure" >&2
  exit "${rc}"
}

bash "${ROOT_DIR}/scripts/infra_server_ctl.sh" ensure >/dev/null

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

pw_run_js() {
  local session="$1"
  local body="$2"
  "${PWCLI}" --session "${session}" run-code "$(printf 'async (page) => {\n%s\n}\n' "${body}")"
}

section_selector() {
  case "$1" in
    status) printf '%s\n' '#section-status' ;;
    approval) printf '%s\n' '#section-jobs' ;;
    audit) printf '%s\n' '#section-audit' ;;
    assign) printf '%s\n' '#section-intake' ;;
    *) printf '%s\n' '#section-status' ;;
  esac
}

sanitize_capture() {
  local session="$1"
  local label="$2"
  local selector="$3"

  pw_run_js "${session}" "$(cat <<EOF
await page.evaluate(({ label, selector }) => {
  const section = document.querySelector(selector);
  if (!section) throw new Error(\`section not found: \${selector}\`);

  const hide = (sel) => {
    section.querySelectorAll(sel).forEach((node) => {
      node.style.display = "none";
    });
  };
  const resetText = (sel, text) => {
    const node = section.querySelector(sel);
    if (node) node.textContent = text;
  };
  const resetInput = (sel, value = "") => {
    const node = section.querySelector(sel);
    if (node) node.value = value;
  };
  const resetSelect = (sel, labelText) => {
    const node = section.querySelector(sel);
    if (!node) return;
    node.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = labelText;
    option.selected = true;
    node.appendChild(option);
  };

  const styleId = "visual-regression-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = "* { animation: none !important; transition: none !important; caret-color: transparent !important; }";
    document.head.appendChild(style);
  }

  if (label === "status") {
    [
      ".status-board",
      "#weeklyKpiCards",
      ".timeline-card",
      "#stalledBoard",
      "#localTrustBoard",
      "#opsQueueBoard",
      "#alerts",
      "#officeView",
      "#agentGrid"
    ].forEach(hide);
  }

  if (label === "approval") {
    ["#jobsKanban", "#jobsTable", "#jobsPagination"].forEach(hide);
    resetSelect("#approveJobSelect", "승인 대기 작업 선택");
    resetSelect("#approvePhase", "pre (변경 전)");
    resetText("#approveResult", "");
  }

  if (label === "audit") {
    ["#auditTable", "#auditPagination"].forEach(hide);
    resetSelect("#auditKindFilter", "전체");
    resetSelect("#auditPhaseFilter", "전체");
    resetSelect("#auditFetchLimit", "200건");
    resetInput("#auditSearchInput", "");
    resetInput("#auditJobIdInput", "");
    resetInput("#auditRequestIdInput", "");
    resetInput("#auditOwnerInput", "");
    resetText("#auditFilterStats", "필터: 전체");
  }

  if (label === "assign") {
    resetSelect("#requestSelect", "요청 선택");
    resetSelect("#repoSelect", "저장소 선택");
    resetInput("#workTypeInput", "");
    resetInput("#missionInput", "");
    resetSelect("#jobPriority", "normal (기본)");
    resetInput("#refinedRequestInput", "");
    resetText("#autoRefineStatus", "자동 정제 대기중입니다.");
    resetText("#jobSubmitResult", "");
    const checkbox = section.querySelector("#applyChanges");
    if (checkbox) checkbox.checked = true;
  }
}, { label: "${label}", selector: "${selector}" });
await page.waitForTimeout(200);
EOF
)"
}

capture_section() {
  local label="$1"
  local url="$2"
  local session="omc-${label}"
  local current_dir="${ROOT_DIR}/output/playwright/current/${label}"
  local baseline_dir="${ROOT_DIR}/output/playwright/baseline/${label}"
  local selector
  mkdir -p "${current_dir}" "${baseline_dir}"

  local after newest baseline capture_name
  capture_name="capture-$(date +%Y%m%d%H%M%S)-${label}.png"
  after="${current_dir}/${capture_name}"
  selector="$(section_selector "${label}")"

  (
    cd "${current_dir}"
    "${PWCLI}" --session "${session}" open "${url}"
    pw_run_js "${session}" "await page.waitForTimeout(900);"
    sanitize_capture "${session}" "${label}" "${selector}"
    pw_run_js "${session}" "await page.locator('${selector}').screenshot({ path: '${after}' });"
    "${PWCLI}" --session "${session}" close
  )

  if [[ ! -f "${after}" ]]; then
    echo "no screenshot captured for ${label}" >&2
    return 1
  fi

  baseline="${baseline_dir}/baseline.png"
  if [[ "${RESET_VISUAL_BASELINE}" == "1" ]]; then
    cp "${after}" "${baseline}"
    echo "baseline_reset:${label}:${baseline}"
    return 0
  fi
  if [[ ! -f "${baseline}" ]]; then
    if [[ "${STRICT_VISUAL_BASELINE}" == "1" ]]; then
      echo "baseline_missing:${label}:${baseline}" >&2
      return 2
    fi
    cp "${after}" "${baseline}"
    echo "baseline_created:${label}:${baseline}"
    return 0
  fi

  if [[ "$(hash_file "${after}")" != "$(hash_file "${baseline}")" ]]; then
    newest="${baseline_dir}/latest-mismatch.png"
    cp "${after}" "${newest}"
    echo "visual_regression:${label}:${newest}"
    return 2
  fi

  echo "visual_ok:${label}"
  return 0
}

failures=0
sections=(
  "status|${BASE_URL}/dashboard/#section-status"
  "approval|${BASE_URL}/dashboard/#section-jobs"
  "audit|${BASE_URL}/dashboard/#section-audit"
  "assign|${BASE_URL}/dashboard/#section-intake"
)

for spec in "${sections[@]}"; do
  label="${spec%%|*}"
  url="${spec##*|}"
  rc=0
  capture_section "${label}" "${url}" || rc=$?
  if [[ "${rc}" -eq 0 ]]; then
    continue
  fi
  if [[ "${rc}" -eq 2 ]]; then
    failures=$((failures + 1))
    continue
  fi
  exit "${rc}"
done

if [[ "${failures}" -gt 0 ]]; then
  echo "playwright visual regression failed: ${failures} section(s) changed" >&2
  exit 1
fi

echo "playwright visual regression passed"
