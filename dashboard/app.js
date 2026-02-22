const stateUrl = "/api/state";
const requestsUrl = "/api/requests";
const jobsUrl = "/api/jobs";
const reposUrl = "/api/repos";
const policiesUrl = "/api/policies";
const ownerUrl = "/api/owner";
const settingsUrl = "/api/settings";
const codexModelsUrl = "/api/codex/models";
const auditUrl = "/api/audit";
const usageUrl = "/api/usage";
const opsQueueUrl = "/api/ops/queue";
const opsPreflightUrl = "/api/ops/preflight";
const opsQueueManageUrl = "/api/ops/queue/manage";
const assignUrl = "/api/jobs/from-request";
const approveUrl = "/api/jobs/approve";
const settingsSaveUrl = "/api/settings/save";
const fallbackCodexModels = ["gpt-5", "gpt-5-mini", "gpt-4.1", "o4-mini"];
const THEME_STORAGE_KEY = "omac-theme-mode";
const NAV_TARGET_STORAGE_KEY = "omac-nav-target";

let timer = null;
let auditSearchTimer = null;
const requestLookup = new Map();
const PIPELINE_STEPS = [
  { id: "pm", label: "PM", desc: "요청 스코프 확정" },
  { id: "cto", label: "CTO", desc: "기술 아키텍처" },
  { id: "pre_approval", label: "변경 전 승인", desc: "Owner 확인" },
  { id: "dev", label: "Dev", desc: "병렬 구현" },
  { id: "design_review", label: "Design", desc: "UX 리뷰 반영" },
  { id: "post_approval", label: "변경 후 승인", desc: "Owner 검수" },
  { id: "qa", label: "QA", desc: "회귀 테스트" },
  { id: "report", label: "Report", desc: "결과 보고" }
];
const RUNNING_STATUSES = new Set(["in_progress"]);
const RUNNING_STAGES = new Set(PIPELINE_STEPS.map((step) => step.id));
const APPROVAL_WAIT_STATUSES = new Set(["waiting_pre_approval", "waiting_post_approval"]);
const QUEUED_STATUSES = new Set(["queued", "dispatching"]);
const DESIGN_OPEN_ROLES = [
  { title: "Lead Product Designer", focus: "대시보드 시스템 UI" },
  { title: "Design Technologist", focus: "컴포넌트 프로토타이핑" },
  { title: "Brand Illustrator", focus: "에이전트 팀 비주얼" }
];
const MARKET_INTELLIGENCE = [
  {
    metric: "미국 CPI (인플레이션)",
    value: "전년 대비 3.0%",
    detail: "2026년 1월 CPI 기준. 핵심(Core) CPI는 3.3%.",
    impact: "가격 민감도가 올라가므로 UI는 결제/비용 안내를 더 명확하게 보여줘야 함",
    source: "https://www.bls.gov/news.release/cpi.nr0.htm",
    released_at: "2026-02-19"
  },
  {
    metric: "미국 고용",
    value: "실업률 4.1%, 비농업 고용 +14.3만",
    detail: "2026년 1월 Employment Situation 발표 기준.",
    impact: "고객사의 채용/운영 예산 변동에 맞춘 단계형 플랜 안내 필요",
    source: "https://www.bls.gov/news.release/empsit.nr0.htm",
    released_at: "2026-02-06"
  },
  {
    metric: "미국 GDP",
    value: "2025년 4분기 연율 +2.3%",
    detail: "BEA Advance Estimate 기준.",
    impact: "신규 기능 제안 시 ROI 근거를 함께 제시해야 의사결정이 빨라짐",
    source: "https://www.bea.gov/news/2026/gross-domestic-product-4th-quarter-and-year-2025-advance-estimate",
    released_at: "2026-01-29"
  },
  {
    metric: "미 연준 정책금리",
    value: "4.25%~4.50% 유지",
    detail: "FOMC 2026-01-28 성명 기준.",
    impact: "고객의 비용 통제 수요가 크므로, UX는 비용/우선순위 선택 흐름을 단순화해야 함",
    source: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260128a.htm",
    released_at: "2026-01-28"
  }
];
const TABLE_PAGINATION = {
  requests: { size: 5, containerId: "requestsPagination" },
  jobs: { size: 5, containerId: "jobsPagination" },
  audit: { size: 8, containerId: "auditPagination" }
};
const paginationState = { requests: 1, jobs: 1, audit: 1 };
const tableCache = { requests: null, jobs: null, audit: null };
const requestFetchState = { limit: 300, offset: 0 };
const jobsFetchState = { limit: 300, offset: 0 };
const auditFetchState = { limit: 200, offset: 0 };
let lastRequestsHeadId = "";
let lastRequestsCount = 0;
const auditFilterState = { kind: "all", q: "", job_id: "", request_id: "" };
let reposCache = [];
let opsQueueCache = null;
let conversationLangMode = "kor";
let lastClientDigestText = "";
let lastPolicySnapshotHtml = "";
let themeMode = "system";
let ownerUiState = { data: null, expandIdentity: false };
const themeMediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const TRANSLATION_RULES = [
  { pattern: /\bclient\b/gi, replacement: "클라이언트" },
  { pattern: /\bowner\b/gi, replacement: "운영자" },
  { pattern: /\brequest\b/gi, replacement: "요청" },
  { pattern: /\bassign(ed)?\b/gi, replacement: "할당" },
  { pattern: /\bupdate(d)?\b/gi, replacement: "업데이트" },
  { pattern: /\bissue(s)?\b/gi, replacement: "이슈" },
  { pattern: /\bplan(s|ned)?\b/gi, replacement: "계획" },
  { pattern: /\bprogress\b/gi, replacement: "진행" },
  { pattern: /\bqa\b/gi, replacement: "QA" },
  { pattern: /\breport\b/gi, replacement: "리포트" }
];
const STAGE_FALLBACK_KO = {
  pm: "PM 팀이 요청 범위를 정리했습니다.",
  cto: "CTO 단계에서 기술 검토를 완료했습니다.",
  dev: "개발 팀이 구현 세부 사항을 공유했습니다.",
  design_review: "디자인 팀이 UX 리뷰 포인트를 반영했습니다.",
  qa: "QA 팀이 검증 상황을 보고했습니다.",
  report: "Report 단계에서 납품 준비를 안내했습니다.",
  pre_approval: "변경 전 승인 단계 안내입니다.",
  post_approval: "변경 후 승인 결과입니다."
};
const STALL_THRESHOLD_MINUTES = 30;
const REQUEST_STALL_MINUTES = 20;
const LOCAL_TRUST_KEYWORDS = ["local trust", "local-trust"];
const FLOW_STEPS = [
  { label: "요청 로그 확인", detail: "감사 로그에서 job_assigned 이전 이벤트 확인" },
  { label: "파이프라인 재현", detail: "PM→CTO→Dev→Design→QA 순으로 최근 메시지 검토" },
  { label: "CEO 결론 기록", detail: "진행/제거 여부와 이유를 리포트 메모에 남김" }
];
const RECOVERY_TEMPLATE = `1) 정체 원인: __
2) 즉시 조치: __
3) 필요 승인/검증: __
4) 재시도 타임라인: __`;
const CLIENT_TEMPLATE = `[변경점]
- (예: Dev 단계 재기동 예정)
[영향]
- (예: 전달 일정 30분 지연)
[리스크]
- (예: owner ID 누락 재발 가능)
[다음 조치]
- (예: OWNER 재검증 → Dev 재시작 → 감사 보고)`;

function rememberRequests(requests = []) {
  requestLookup.clear();
  requests.forEach((req) => {
    if (req && typeof req.id !== "undefined") {
      requestLookup.set(String(req.id), req);
    }
  });
}

function findRequestById(id) {
  if (!id) return null;
  return requestLookup.get(String(id)) || null;
}

function safeDomId(prefix, seed) {
  const slug = String(seed ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "-") || "x";
  return `${prefix}-${slug}`;
}

function normalizeThemeMode(mode) {
  return ["light", "dark", "system"].includes(mode) ? mode : "system";
}

function resolveTheme(mode) {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return themeMediaQuery?.matches ? "dark" : "light";
}

function applyTheme(mode, options = {}) {
  const safeMode = normalizeThemeMode(mode);
  const persist = options.persist !== false;
  themeMode = safeMode;
  const resolved = resolveTheme(safeMode);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-mode", safeMode);
  const select = document.getElementById("themeMode");
  if (select && select.value !== safeMode) select.value = safeMode;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeMode);
    } catch (_) {
      // ignore storage failures in private/locked environments
    }
  }
}

function setupThemeMode() {
  const select = document.getElementById("themeMode");
  if (!select) return;
  let saved = "system";
  try {
    saved = normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY) || "system");
  } catch (_) {
    saved = "system";
  }
  applyTheme(saved, { persist: false });

  select.addEventListener("change", () => {
    applyTheme(select.value, { persist: true });
  });

  if (themeMediaQuery) {
    const handler = () => {
      if (themeMode === "system") applyTheme("system", { persist: false });
    };
    if (typeof themeMediaQuery.addEventListener === "function") {
      themeMediaQuery.addEventListener("change", handler);
    } else if (typeof themeMediaQuery.addListener === "function") {
      themeMediaQuery.addListener(handler);
    }
  }
}

function applyPagination(key, list) {
  const config = TABLE_PAGINATION[key];
  if (!config) {
    return { pageItems: list, page: 1, totalPages: 1, totalItems: list.length };
  }
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / config.size));
  const current = Math.min(Math.max(1, paginationState[key] || 1), totalPages);
  paginationState[key] = current;
  const start = (current - 1) * config.size;
  return { pageItems: list.slice(start, start + config.size), page: current, totalPages, totalItems };
}

function renderPaginationControls(key, meta) {
  const config = TABLE_PAGINATION[key];
  if (!config) return;
  const root = document.getElementById(config.containerId);
  if (!root) return;
  if (meta.totalItems <= config.size) {
    root.innerHTML = "";
    return;
  }
  const prevPage = Math.max(1, meta.page - 1);
  const nextPage = Math.min(meta.totalPages, meta.page + 1);
  const prevDisabled = meta.page <= 1 ? "disabled" : "";
  const nextDisabled = meta.page >= meta.totalPages ? "disabled" : "";
  root.innerHTML = `
    <div class="pagination-inner">
      <button type="button" ${prevDisabled} data-pagination="1" data-key="${esc(key)}" data-page="${prevPage}">이전</button>
      <span class="pagination-info">페이지 ${esc(meta.page)} / ${esc(meta.totalPages)} · 총 ${esc(meta.totalItems)}건</span>
      <button type="button" ${nextDisabled} data-pagination="1" data-key="${esc(key)}" data-page="${nextPage}">다음</button>
    </div>
  `;
}

function setupPaginationDelegation() {
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-pagination]");
    if (!btn) return;
    event.preventDefault();
    const key = btn.dataset.key;
    const page = Number(btn.dataset.page);
    if (!key || Number.isNaN(page) || !TABLE_PAGINATION[key]) return;
    paginationState[key] = page;
    if (key === "requests") {
      requestFetchState.offset = (page - 1) * TABLE_PAGINATION.requests.size;
      await loadAll();
      return;
    }
    if (key === "jobs") {
      jobsFetchState.offset = (page - 1) * TABLE_PAGINATION.jobs.size;
      await loadAll();
      return;
    }
    if (key === "requests" && tableCache.requests) {
      renderRequests(tableCache.requests);
    } else if (key === "jobs" && tableCache.jobs) {
      renderJobs(tableCache.jobs);
    } else if (key === "audit" && tableCache.audit) {
      renderAudit(tableCache.audit);
    }
  });
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractActionItems(raw) {
  const lines = String(raw || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLike = lines.filter((line) => /^[-*•\d]/.test(line));
  const source = bulletLike.length ? bulletLike : lines;
  const picked = source.slice(0, 3).map((line) => line.replace(/^[-*•\d.)\s]+/, ""));
  return picked.length ? picked : ["요청 내용을 실행 단계로 세분화하세요."];
}

function buildAutoRefinedText(request) {
  const { id, client_name, raw_request } = request;
  const summary = normalizeWhitespace(raw_request);
  const summaryLine = summary
    ? summary.length > 240
      ? `${summary.slice(0, 240)}...`
      : summary
    : "원문 요청이 비어 있습니다. 클라이언트 메모를 다시 확인하세요.";
  const actions = extractActionItems(raw_request);
  const acceptance = actions.map((item) => `${item} 플로우를 재현하고 결과를 리포트에 첨부한다.`);
  return [
    `[요청 ID] ${id} · ${client_name || "클라이언트 미지정"}`,
    `[요약] ${summaryLine}`,
    `[주요 작업]`,
    ...actions.map((item, idx) => `${idx + 1}. ${item}`),
    `[완료 기준]`,
    ...acceptance.map((item, idx) => `${idx + 1}. ${item}`),
    `+ 모든 변경사항을 테스트/QA 증빙과 함께 보고합니다.`
  ].join("\n");
}

function setAutoRefineStatus(message, isError = false) {
  const statusEl = document.getElementById("autoRefineStatus");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("text-error", !!isError);
}

function autoFillRefinedRequest({ requestId = "", force = false } = {}) {
  const select = document.getElementById("requestSelect");
  const refinedInput = document.getElementById("refinedRequestInput");
  if (!refinedInput || !select) return;
  const id = requestId || select.value;
  if (!id) {
    setAutoRefineStatus("대상 요청을 먼저 선택하세요.", true);
    return;
  }
  const data = requestLookup.get(String(id));
  if (!data) {
    setAutoRefineStatus("선택한 요청 정보를 찾을 수 없습니다.", true);
    return;
  }
  if (!force && refinedInput.dataset.userEdited === "1" && refinedInput.dataset.boundRequest === String(id)) {
    setAutoRefineStatus("직접 편집된 내용이 있어 자동 정제를 건너뜁니다.");
    return;
  }
  refinedInput.value = buildAutoRefinedText(data);
  refinedInput.dataset.boundRequest = String(id);
  refinedInput.dataset.userEdited = "0";
  setAutoRefineStatus(`자동 정제 완료 · ${new Date().toLocaleTimeString("ko-KR")}`);
}

function setupAutoRefineControls() {
  const refinedInput = document.getElementById("refinedRequestInput");
  if (refinedInput) {
    refinedInput.dataset.userEdited = refinedInput.dataset.userEdited || "0";
    refinedInput.addEventListener("input", () => {
      refinedInput.dataset.userEdited = "1";
      setAutoRefineStatus("직접 편집중입니다.");
    });
  }

  const requestSelect = document.getElementById("requestSelect");
  if (requestSelect) {
    requestSelect.addEventListener("change", (event) => {
      autoFillRefinedRequest({ requestId: event.target.value, force: true });
    });
  }

  const autoBtn = document.getElementById("autoRefineBtn");
  if (autoBtn) {
    autoBtn.addEventListener("click", () => autoFillRefinedRequest({ force: true }));
  }

  const jobForm = document.getElementById("jobForm");
  if (jobForm) {
    jobForm.addEventListener("reset", () => {
      if (refinedInput) {
        refinedInput.dataset.userEdited = "0";
        delete refinedInput.dataset.boundRequest;
      }
      setAutoRefineStatus("자동 정제 대기중입니다.");
    });
  }

  setAutoRefineStatus("자동 정제 대기중입니다.");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function esc(value) {
  return escapeHtml(value);
}

function refillSelectPreservingValue(selectEl, placeholderLabel, optionsHtml) {
  const prev = selectEl.value;
  selectEl.innerHTML = `<option value="">${esc(placeholderLabel)}</option>${optionsHtml}`;
  if (prev && Array.from(selectEl.options).some((opt) => opt.value === prev)) {
    selectEl.value = prev;
  }
}

function fillCodexModelSelect(models, selected) {
  const select = document.getElementById("codexModel");
  const list = Array.isArray(models) ? models : [];
  const custom = selected && !list.includes(selected) ? [selected] : [];
  const merged = [...custom, ...list];
  const optionsHtml = merged.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  refillSelectPreservingValue(select, "CLI 기본값 사용", optionsHtml);
  if (selected && Array.from(select.options).some((o) => o.value === selected)) {
    select.value = selected;
  }
}

function ownerPayload() {
  const ownerId = document.getElementById("ownerId").value.trim() || "local-owner";
  return {
    owner_id: ownerId,
    owner_token: document.getElementById("ownerToken").value.trim()
  };
}

function fmtPct(value) {
  return `${Math.round(value * 100)}%`;
}

function statusClass(status) {
  const token = String(status || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return `status-${token || "idle"}`;
}

function statusKo(status) {
  const map = {
    healthy: "정상",
    warning: "주의",
    critical: "위험",
    idle: "대기",
    received: "접수됨",
    in_company: "회사 처리중",
    completed: "완료",
    responded: "응대완료",
    queued: "대기열",
    dispatching: "배정중",
    dispatch: "배정중",
    pm: "PM",
    cto: "CTO",
    dev: "개발",
    design_review: "디자인",
    qa: "QA",
    report: "보고",
    pre_approval: "변경 전 승인",
    post_approval: "변경 후 승인",
    in_progress: "진행중",
    waiting_pre_approval: "변경 전 승인 대기",
    waiting_post_approval: "변경 후 승인 대기",
    done: "완료",
    failed: "실패"
  };
  return map[status] || status || "-";
}

function priorityKo(priority) {
  const map = {
    urgent: "최우선",
    high: "높음",
    normal: "기본",
    low: "낮음"
  };
  return map[priority] || "기본";
}

function normalizePriority(priority) {
  const token = String(priority || "").toLowerCase();
  if (["urgent", "high", "normal", "low"].includes(token)) return token;
  return "normal";
}

function priorityClass(priority) {
  return `priority-${normalizePriority(priority)}`;
}

function priorityOrder(priority) {
  const map = { urgent: 0, high: 1, normal: 2, low: 3 };
  return map[normalizePriority(priority)];
}

function translateToKorean(text) {
  return TRANSLATION_RULES.reduce((acc, rule) => acc.replace(rule.pattern, rule.replacement), text);
}

function toClientFriendlyActor(actor, stage) {
  const token = String(actor || "").trim().toLowerCase();
  const actorMap = {
    "product planning": "기획팀",
    "pm": "기획팀",
    "cto": "기술총괄",
    "codex": "개발팀",
    "dev": "개발팀",
    "qa": "품질팀",
    "system": "운영 시스템",
    "시스템": "운영 시스템",
    "team": "운영팀",
    "팀": "운영팀",
  };
  if (actorMap[token]) return actorMap[token];
  if (stage && STAGE_FALLBACK_KO[stage]) return `${statusKo(stage)} 팀`;
  return actor || "운영팀";
}

function toClientFriendlyMessage(rawMessage, stage) {
  const message = String(rawMessage || "").trim();
  if (!message) return STAGE_FALLBACK_KO[stage] || "팀에서 작업 상황을 업데이트했습니다.";

  if (/^failed:/i.test(message)) {
    return "작업 중 이슈가 감지되어 원인 분석과 안정화 조치를 진행 중입니다.";
  }
  if (/stage started/i.test(message)) {
    return `${statusKo(stage || "-")} 단계 검토를 시작했습니다.`;
  }
  if (/waiting for pre-change approval/i.test(message)) {
    return "변경 전 검토를 마치고 운영자 승인 대기 중입니다.";
  }
  if (/waiting for post-change approval/i.test(message)) {
    return "변경 반영 후 검증을 마치고 최종 승인 대기 중입니다.";
  }
  if (/owner approved/i.test(message)) {
    return "운영자 승인 완료로 다음 단계를 진행합니다.";
  }
  if (/report stage complete\. job done\./i.test(message)) {
    return "리포트 작성과 내부 검증이 완료되어 전달 준비를 마쳤습니다.";
  }
  if (/post-completion audit generated/i.test(message)) {
    return "완료 후 품질 점검 기록을 생성했습니다.";
  }
  if (/^codex run:/i.test(message)) {
    return "자동화 실행 결과를 검토해 작업에 반영했습니다.";
  }
  if (/regression and release checks/i.test(message)) {
    return "회귀 및 배포 안정성 점검을 진행했습니다.";
  }

  const translated = translateToKorean(message);
  if (translated !== message) return translated;
  return STAGE_FALLBACK_KO[stage] || "팀에서 작업 상황을 업데이트했습니다.";
}

function renderConversationLine(event) {
  const message = event.message || "-";
  const stage = event.stage || "";
  const english = esc(message);
  const korean = toClientFriendlyMessage(message, stage);
  const showKor = conversationLangMode === "kor" || conversationLangMode === "bilingual";
  const showEng = conversationLangMode === "eng" || conversationLangMode === "bilingual";
  const korLine = showKor ? `<p>${esc(korean)}</p>` : "";
  const engLine = showEng ? `<p class="en-line">${english}</p>` : "";
  return `${korLine}${engLine}` || `<p>${esc(message)}</p>`;
}

function weightedAgentScore(agent) {
  const latency = Number(agent.latency_ms || 0);
  const errorRate = Number(agent.error_rate || 0);
  const scoreByStatus = { healthy: 95, warning: 70, critical: 35, idle: 85 };
  const statusScore = scoreByStatus[agent.status] ?? 60;
  const latencyScore = Math.max(0, Math.min(100, 100 - latency / 8));
  const errorScore = Math.max(0, Math.min(100, 100 - errorRate * 800));
  return Math.round(statusScore * 0.55 + latencyScore * 0.25 + errorScore * 0.2);
}

function renderMission(data) {
  document.getElementById("workType").textContent = `업무 유형: ${data.work_type || "미정"}`;
  document.getElementById("missionText").textContent = `미션: ${data.company_mission || "--"}`;
}

function renderOwnerModeBadge(owner) {
  const mode = owner.owner_mode_enabled ? "Owner 모드 (기본)" : "Owner 모드 비활성";
  document.getElementById("ownerModeBadge").textContent = `모드: ${mode}`;
}

function syncOwnerIdentityPanel() {
  const panel = document.getElementById("ownerIdentityPanel");
  const toggle = document.getElementById("ownerIdentityToggle");
  if (!panel || !toggle) return;
  const owner = ownerUiState.data || {};
  const allowCollapse = owner.owner_mode_enabled && !owner.owner_token_required;
  const collapsed = allowCollapse && !ownerUiState.expandIdentity;
  panel.classList.toggle("is-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.textContent = collapsed ? "고급 입력 보기" : "고급 입력 숨기기";
}

function setupOwnerIdentityToggle() {
  const toggle = document.getElementById("ownerIdentityToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    ownerUiState.expandIdentity = !ownerUiState.expandIdentity;
    syncOwnerIdentityPanel();
  });
}

function renderSummary(summary) {
  const root = document.getElementById("summaryCards");
  root.innerHTML = [
    ["전체", summary.total],
    ["정상", summary.healthy],
    ["주의", summary.warning],
    ["위험", summary.critical]
  ].map(([label, value]) => `<div class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join("");
}

function renderAlerts(agents) {
  const critical = agents.filter((a) => a.status === "critical");
  const root = document.getElementById("alerts");
  if (!critical.length) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = critical.map((a) => `<div class="alert"><strong>${esc(a.name)}</strong> ${esc(a.blocker || "즉시 확인이 필요합니다.")}</div>`).join("");
}

function renderAgents(agents) {
  const root = document.getElementById("agentGrid");
  root.innerHTML = agents.map((agent) => `
    <article class="agent">
      <header>
        <div>
          <div>
            <span class="status-dot ${statusClass(agent.status)}"></span>
            <strong>${esc(agent.name)}</strong>
            ${String(agent.id || "").startsWith("lead-") || String(agent.id || "") === "tech-lead" ? `<span class="tag priority-high">팀장</span>` : ""}
          </div>
          <small>${esc(agent.team)}</small>
        </div>
        <small>${esc(String(agent.status || "").toUpperCase())}</small>
      </header>
      <ul>
        <li><strong>현재 작업:</strong> ${esc(agent.current_task)}</li>
        <li><strong>이니셔티브:</strong> ${esc(agent.initiative || "-")}</li>
        <li><strong>지연:</strong> ${esc(agent.latency_ms)} ms</li>
        <li><strong>에러율:</strong> ${esc(fmtPct(agent.error_rate))}</li>
        <li><strong>다음 핸드오프:</strong> ${esc(agent.next_handoff)}</li>
      </ul>
    </article>
  `).join("");
}

function renderOffice(agents) {
  const root = document.getElementById("officeView");
  if (!agents.length) {
    root.innerHTML = `<p class="muted">픽셀 오피스를 렌더링할 에이전트가 없습니다.</p>`;
    return;
  }

  const roleClassForTeam = (team) => {
    const token = String(team || "").trim().toLowerCase();
    if (["design"].includes(token)) return "role-design";
    if (["dev", "engineering"].includes(token)) return "role-dev";
    if (["qa"].includes(token)) return "role-qa";
    if (["infra", "infrastructure"].includes(token)) return "role-infra";
    if (["security"].includes(token)) return "role-security";
    if (["marketing"].includes(token)) return "role-marketing";
    if (["pm", "product"].includes(token)) return "role-pm";
    if (["cto", "ceo", "executive"].includes(token)) return "role-lead";
    return "role-general";
  };
  const statusSignal = (status) => {
    if (status === "healthy") return "정상";
    if (status === "warning") return "주의";
    if (status === "critical") return "위험";
    return "대기";
  };
  const scoreClass = (score) => {
    if (score >= 85) return "good";
    if (score >= 70) return "warn";
    return "bad";
  };
  const emoteForAgent = (agent, index) => {
    const st = String(agent.status || "idle");
    if (st === "critical") return "ALERT";
    if (st === "warning") return index % 2 === 0 ? "FIXING" : "CHECK";
    if (st === "healthy") return index % 3 === 0 ? "FOCUS" : index % 3 === 1 ? "BUILD" : "SYNC";
    return "IDLE";
  };
  const monitorState = (agent) => {
    const st = String(agent.status || "idle");
    if (st === "critical") return "incident";
    if (st === "warning") return "review";
    if (st === "healthy") return "typing...";
    return "standby";
  };

  const healthy = agents.filter((a) => a.status === "healthy").length;
  const warning = agents.filter((a) => a.status === "warning").length;
  const critical = agents.filter((a) => a.status === "critical").length;
  const active = agents.filter((a) => String(a.current_task || "").trim()).length;
  const jobs = Array.isArray(tableCache.jobs?.jobs) ? tableCache.jobs.jobs : [];
  const queuedJobs = jobs.filter((j) => ["queued", "dispatching"].includes(j.status)).length;
  const runningJobs = jobs.filter((j) => ["in_progress", "waiting_pre_approval", "waiting_post_approval"].includes(j.status)).length;
  const deliveredJobs = jobs.filter((j) => j.status === "done").length;
  const avgLatency = Math.round(agents.reduce((sum, a) => sum + Number(a.latency_ms || 0), 0) / Math.max(1, agents.length));
  const avgError = agents.reduce((sum, a) => sum + Number(a.error_rate || 0), 0) / Math.max(1, agents.length);
  const opsScore = Math.round(agents.reduce((sum, a) => sum + weightedAgentScore(a), 0) / Math.max(1, agents.length));

  const teams = Object.entries(
    agents.reduce((acc, agent) => {
      const key = String(agent.team || "general");
      if (!acc[key]) acc[key] = [];
      acc[key].push(agent);
      return acc;
    }, {})
  )
    .map(([team, items]) => {
      const score = Math.round(items.reduce((sum, a) => sum + weightedAgentScore(a), 0) / Math.max(1, items.length));
      const busy = items.filter((a) => String(a.current_task || "").trim()).length;
      return { team, score, busy, size: items.length };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const liveFeed = agents
    .slice()
    .sort((a, b) => weightedAgentScore(b) - weightedAgentScore(a))
    .slice(0, 5)
    .map((a) => `${a.team} · ${a.name}: ${a.current_task || a.initiative || "작업 동기화 중"}`);
  const feedLoop = liveFeed.length ? [...liveFeed, ...liveFeed] : ["라이브 액티비티 데이터가 없습니다."];
  const queuePreview = jobs
    .slice()
    .sort((a, b) => eventTimestamp(b.created_at) - eventTimestamp(a.created_at))
    .slice(0, 6)
    .map((j) => j.id);

  const desks = agents
    .map((agent, index) => {
      const score = weightedAgentScore(agent);
      const roleClass = roleClassForTeam(agent.team);
      return `
        <article class="pixel-desk ${statusClass(agent.status)}">
          <header>
            <strong>${esc(agent.name)}</strong>
            <span class="pixel-signal ${statusClass(agent.status)}">${esc(statusSignal(agent.status))}</span>
          </header>
          <div class="pixel-station">
            <div class="pixel-monitor ${statusClass(agent.status)}">
              <span class="monitor-title">${esc(agent.team || "Team")}</span>
              <span class="monitor-state">${esc(monitorState(agent))}</span>
            </div>
            <div class="pixel-worker">
              <span class="pixel-emote ${statusClass(agent.status)}">${esc(emoteForAgent(agent, index))}</span>
              <div
                class="pixel-avatar ${roleClass} ${statusClass(agent.status)}"
                role="img"
                aria-label="${esc(agent.name)} pixel avatar (${esc(agent.team || "team")})"
              ></div>
            </div>
            <div class="pixel-props" aria-hidden="true">
              <span class="pixel-mug"></span>
              <span class="pixel-lamp"></span>
            </div>
          </div>
          <p class="pixel-task">${esc(agent.current_task || "업무 대기중")}</p>
          <div class="pixel-kpis">
            <span>지연 ${esc(agent.latency_ms)}ms</span>
            <span>에러 ${esc(fmtPct(agent.error_rate))}</span>
          </div>
          <small class="pixel-handoff">다음: ${esc(agent.next_handoff || "-")}</small>
          <div class="pixel-score">
            <div class="pixel-score-bar ${scoreClass(score)}" style="width:${Math.max(8, Math.min(100, score))}%"></div>
            <small>${esc(score)}점</small>
          </div>
        </article>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="pixel-office-scene">
      <div class="pixel-office-topline">
        <div class="pixel-building" aria-hidden="true"></div>
        <div class="pixel-banner">
          <strong>oh-my-agent-company Tycoon Ops Floor</strong>
          <small>편의점 타이쿤 감성으로 현재 업무/대기열/팀 가동률을 한눈에 보여주는 운영 매장 뷰</small>
          <div class="pixel-legend">
            <span><i class="dot healthy"></i>정상 ${healthy}</span>
            <span><i class="dot warning"></i>주의 ${warning}</span>
            <span><i class="dot critical"></i>위험 ${critical}</span>
            <span><i class="dot idle"></i>활성 업무 ${active}</span>
          </div>
        </div>
      </div>
      <div class="pixel-tycoon-strip">
        <span class="pixel-badge">입점 대기 ${queuedJobs}</span>
        <span class="pixel-badge">매장 처리중 ${runningJobs}</span>
        <span class="pixel-badge">납품 완료 ${deliveredJobs}</span>
        <div class="pixel-cashline">
          ${queuePreview.length ? queuePreview.map((id) => `<em>${esc(id)}</em>`).join("") : "<em>신규 업무 대기열 비어있음</em>"}
        </div>
      </div>
      <div class="pixel-tycoon-layout">
        <section class="pixel-shop-floor">
          <div class="pixel-aisles" aria-hidden="true">
            <span class="pixel-shelf"></span>
            <span class="pixel-shelf"></span>
            <span class="pixel-shelf"></span>
            <span class="pixel-shelf"></span>
          </div>
          <div class="pixel-desks">${desks}</div>
        </section>
        <aside class="pixel-hud">
          <div class="pixel-hud-card">
            <strong>매장 운영 점수</strong>
            <p>${opsScore}점</p>
            <small>전체 ${agents.length}명 기준</small>
          </div>
          <div class="pixel-hud-card">
            <strong>품질 체감 지표</strong>
            <p>${avgLatency}ms · ${fmtPct(avgError)}</p>
            <small>응답 속도와 오류율의 균형</small>
          </div>
          <div class="pixel-hud-card">
            <strong>팀 카운터 점유율</strong>
            <ul>
              ${teams.map((t) => `<li><span>${esc(t.team)}</span><em>${esc(t.busy)}/${esc(t.size)} · ${esc(t.score)}점</em></li>`).join("")}
            </ul>
          </div>
        </aside>
      </div>
      <div class="pixel-feed">
        <strong>라이브 액티비티</strong>
        <div class="pixel-feed-track">
          ${feedLoop.map((line) => `<span>${esc(line)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderTeamHealth(agents) {
  const root = document.getElementById("teamHealth");
  if (!root) return;
  if (!Array.isArray(agents) || !agents.length) {
    root.innerHTML = `<p class="muted">팀 헬스를 계산할 에이전트 데이터가 없습니다.</p>`;
    return;
  }

  const byTeam = agents.reduce((acc, agent) => {
    if (!acc[agent.team]) acc[agent.team] = [];
    acc[agent.team].push(agent);
    return acc;
  }, {});

  const getLevel = (score) => {
    if (score >= 85) return { key: "stable", label: "안정", guide: "현재 운영 정책 유지 + 주 1회 점검" };
    if (score >= 70) return { key: "watch", label: "주의", guide: "병목 단계 우선 점검 + 핸드오프 리드타임 단축" };
    return { key: "risk", label: "위험", guide: "즉시 인력 재배치 + CTO/QA 합동 대응" };
  };

  const entries = Object.entries(byTeam).map(([team, items]) => {
    const score = Math.round(items.map(weightedAgentScore).reduce((s, v) => s + v, 0) / items.length);
    const warningCount = items.filter((agent) => agent.status === "warning").length;
    const criticalCount = items.filter((agent) => agent.status === "critical").length;
    const avgLatency = Math.round(items.reduce((sum, agent) => sum + Number(agent.latency_ms || 0), 0) / items.length);
    const avgError = items.reduce((sum, agent) => sum + Number(agent.error_rate || 0), 0) / items.length;
    const level = getLevel(score);
    return { team, score, warningCount, criticalCount, avgLatency, avgError, size: items.length, level };
  });

  const overallScore = Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length);
  const riskTeams = entries.filter((entry) => entry.level.key === "risk").length;
  const watchTeams = entries.filter((entry) => entry.level.key === "watch").length;
  const summaryLevel = getLevel(overallScore);

  root.innerHTML = `
    <article class="team-health-overview ${summaryLevel.key}">
      <div>
        <p class="eyebrow">왜 필요한가</p>
        <h3>팀 헬스는 납품 리스크 조기 경보판입니다.</h3>
        <p class="muted">가중치(상태 55% + 지연 25% + 에러율 20%)로 병목 팀을 먼저 보여주어, 클라이언트 영향 전에 대응하게 합니다.</p>
      </div>
      <div class="team-health-kpis">
        <div class="kpi"><strong>${esc(entries.length)}</strong><small>활성 팀</small></div>
        <div class="kpi"><strong>${esc(overallScore)}</strong><small>전체 점수</small></div>
        <div class="kpi"><strong>${esc(watchTeams)}</strong><small>주의 팀</small></div>
        <div class="kpi"><strong>${esc(riskTeams)}</strong><small>위험 팀</small></div>
      </div>
    </article>
    <div class="team-health-grid">
      ${entries
        .sort((a, b) => a.score - b.score)
        .map(
          (entry) => `
            <article class="team ${entry.level.key}">
              <header>
                <strong>${esc(entry.team)}</strong>
                <span class="tag">${esc(entry.level.label)}</span>
              </header>
              <div class="team-score">${esc(entry.score)} / 100</div>
              <div class="bar"><div class="fill" style="width:${entry.score}%"></div></div>
              <ul class="team-metrics">
                <li>팀원: ${esc(entry.size)}명</li>
                <li>평균 지연: ${esc(entry.avgLatency)} ms</li>
                <li>평균 에러율: ${esc(fmtPct(entry.avgError))}</li>
                <li>경고/위험: ${esc(entry.warningCount)} / ${esc(entry.criticalCount)}</li>
              </ul>
              <p class="team-guide"><strong>권장 조치:</strong> ${esc(entry.level.guide)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDesignBoard(state) {
  const rolesRoot = document.getElementById("designOpenRoles");
  const statsRoot = document.getElementById("designStats");
  const profileRoot = document.getElementById("designProfile");
  if (!rolesRoot || !statsRoot || !profileRoot) return;

  const agents = Array.isArray(state.agents) ? state.agents.filter((agent) => /design/i.test(agent.team || "")) : [];
  const isOperational = agents.length > 0;
  rolesRoot.innerHTML = DESIGN_OPEN_ROLES
    .map((role) => `<li class="design-role"><strong>${esc(role.title)}</strong><span>${esc(role.focus)}</span><em>${isOperational ? "운영중" : "즉시 신설 필요"}</em></li>`)
    .join("");

  const unavailable = agents.filter((agent) => agent.status !== "healthy").length;
  const issueCount = Math.max(1, Number(state.summary?.warning || 0) + Number(state.summary?.critical || 0));
  const stats = [
    { label: "현 디자인 인원", value: `${agents.length}명`, helper: unavailable ? `${unavailable}명 이슈 해결중` : "모두 가용" },
    { label: "UI 결함 추적", value: `${issueCount}건`, helper: "경고/위험 지표 기준" },
    { label: "운영 역할", value: `${DESIGN_OPEN_ROLES.length}개`, helper: isOperational ? "역할별 운영중" : "역할별 즉시 구성 필요" }
  ];
  statsRoot.innerHTML = stats
    .map(
      (stat) => `
        <div class="design-stat">
          <strong>${esc(stat.value)}</strong>
          <small>${esc(stat.label)}</small>
          <p>${esc(stat.helper)}</p>
        </div>
      `
    )
    .join("");

  if (!agents.length) {
    profileRoot.innerHTML = `
      <div class="design-profile-card is-empty">
        <p class="eyebrow">Design Agent Team</p>
        <h4>즉시 신설 필요</h4>
        <p class="muted">디자인 전담 에이전트가 감지되지 않았습니다. 정책 기준상 즉시 운영 조직을 활성화해야 합니다.</p>
        <ul class="profile-list">
          ${DESIGN_OPEN_ROLES.map((role) => `<li>${esc(role.title)} · ${esc(role.focus)}</li>`).join("")}
        </ul>
        <div class="profile-note">Design Ops와 Frontend가 공통 컴포넌트 레지스트리를 즉시 구성합니다.</div>
      </div>
    `;
  } else {
    const sorted = [...agents].sort((a, b) => weightedAgentScore(b) - weightedAgentScore(a));
    const lead = sorted[0];
    profileRoot.innerHTML = `
      <div class="design-profile-card">
        <p class="eyebrow">Design Ops Lead</p>
        <h4>${esc(lead.name)}</h4>
        <p>${esc(lead.current_task || "UI 재구성 진행중")}</p>
        <ul class="profile-list">
          <li>팀: ${esc(lead.team)}</li>
          <li>지연: ${esc(lead.latency_ms)} ms</li>
          <li>에러율: ${esc(fmtPct(lead.error_rate))}</li>
          <li>다음 핸드오프: ${esc(lead.next_handoff || "-")}</li>
        </ul>
        <div class="profile-note">가중치 ${weightedAgentScore(lead)}점 · ${esc(statusKo(lead.status))}</div>
      </div>
    `;
  }
}

function setTimestamp(isoString) {
  document.getElementById("lastUpdated").textContent = `업데이트: ${formatDateTimeFull(isoString)}`;
}

function renderUsage(usage) {
  const stamp = `Codex 사용량(로컬): API ${usage.api_calls_total}회 | 요청 ${usage.requests_total}건 | 작업 ${usage.jobs_total}건 | 완료 ${usage.jobs_done}건 | 변경 파일 ${usage.files_changed_total}개`;
  document.getElementById("usageStamp").textContent = stamp;
}

function formatDateTimeFull(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
}

function renderRequests(payload) {
  tableCache.requests = payload;
  const requests = [...(payload.requests || [])].sort((a, b) => eventTimestamp(b.created_at) - eventTimestamp(a.created_at));
  const headId = String(requests[0]?.id || "");
  const hasNewHead = headId && headId !== lastRequestsHeadId;
  const countChanged = requests.length !== lastRequestsCount;
  if (hasNewHead || countChanged) {
    paginationState.requests = 1;
  }
  lastRequestsHeadId = headId;
  lastRequestsCount = requests.length;
  rememberRequests(requests);
  const root = document.getElementById("requestsTable");
  if (!requests.length) {
    root.innerHTML = `<p class="muted">접수된 클라이언트 요청이 없습니다.</p>`;
    renderPaginationControls("requests", { page: 1, totalPages: 1, totalItems: 0 });
  } else {
    const pagination = applyPagination("requests", requests);
    const rows = pagination.pageItems;
    root.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead>
          <tr><th>요청 ID</th><th>접수 시각</th><th>클라이언트</th><th>상태</th><th>원본 요청</th><th>연결 작업</th></tr>
        </thead>
        <tbody>
          ${rows.map((r) => `<tr><td><code>${esc(r.id)}</code></td><td>${esc(formatDateTimeFull(r.created_at))}</td><td>${esc(r.client_name)}</td><td><span class="tag">${esc(statusKo(r.status))}</span></td><td>${esc(r.raw_request)}</td><td>${r.linked_job_id ? `<code>${esc(r.linked_job_id)}</code>` : "-"}</td></tr>`).join("")}
        </tbody>
      </table></div>`;
    renderPaginationControls("requests", pagination);
  }

  const requestSelect = document.getElementById("requestSelect");
  refillSelectPreservingValue(
    requestSelect,
    "요청 선택",
    requests
    .filter((r) => r.status === "received")
    .map((r) => `<option value="${esc(r.id)}">${esc(r.id)} | ${esc(r.client_name)} | ${esc(r.status)}</option>`)
    .join("")
  );

  autoFillRefinedRequest({ requestId: requestSelect.value });
}

function describeJob(job) {
  const meta = [job.work_type, job.mission].map((value) => normalizeWhitespace(value)).filter(Boolean);
  return meta.join(" · ");
}

function shortRepoName(path) {
  const token = String(path || "").trim();
  if (!token) return "-";
  const parts = token.split("/");
  return parts[parts.length - 1] || token;
}

function reportPathToHref(pathValue) {
  const raw = String(pathValue || "").trim();
  if (!raw) return "";
  if (raw.startsWith("./")) return `/${raw.slice(2)}`;
  if (raw.startsWith("/")) {
    const marker = "/deliverables/";
    const idx = raw.indexOf(marker);
    if (idx >= 0) return raw.slice(idx);
    return raw;
  }
  if (raw.startsWith("deliverables/")) return `/${raw}`;
  return raw;
}

function pickActiveJob(jobs = []) {
  if (!jobs.length) return null;
  const priority = jobs.find((job) => RUNNING_STATUSES.has(job.status) || APPROVAL_WAIT_STATUSES.has(job.status) || QUEUED_STATUSES.has(job.status));
  if (priority) return priority;
  const ongoing = jobs.find((job) => job.status && !["done", "failed"].includes(job.status));
  return ongoing || jobs[0] || null;
}

function renderPipeline(job) {
  const stepsEl = document.getElementById("pipelineSteps");
  const emptyEl = document.getElementById("pipelineEmptyState");
  const titleEl = document.getElementById("activeJobTitle");
  const metaEl = document.getElementById("activeJobMeta");
  const stageEl = document.getElementById("activeJobStage");
  const statusEl = document.getElementById("activeJobStatus");
  if (!stepsEl) return;

  if (!job) {
    stepsEl.innerHTML = "";
    if (titleEl) titleEl.textContent = "실행중인 작업이 없습니다.";
    if (metaEl) metaEl.textContent = "새로운 작업을 할당하면 상태가 여기에 표시됩니다.";
    if (stageEl) stageEl.textContent = "--";
    if (statusEl) {
      statusEl.textContent = "--";
      statusEl.classList.remove("status-ok", "status-warn", "status-bad");
    }
    if (emptyEl) emptyEl.classList.remove("is-hidden");
    return;
  }

  const activeIdx = PIPELINE_STEPS.findIndex((step) => step.id === job.stage);
  const safeIdx = activeIdx >= 0 ? activeIdx : -1;
  stepsEl.innerHTML = PIPELINE_STEPS.map((step, idx) => {
    const state = safeIdx === -1 ? (idx === 0 ? "current" : "upcoming") : idx < safeIdx ? "complete" : idx === safeIdx ? "current" : "upcoming";
    return `
      <li class="pipeline-step ${state}">
        <span class="step-index">${idx + 1}</span>
        <div>
          <strong>${esc(step.label)}</strong>
          <small>${esc(step.desc)}</small>
        </div>
      </li>
    `;
  }).join("");

  if (titleEl) {
    const client = job.client_name ? ` · ${job.client_name}` : "";
    titleEl.textContent = `${job.id}${client}`;
  }
  if (metaEl) {
    metaEl.textContent = describeJob(job) || "정제된 작업 내용을 확인하세요.";
  }
  if (stageEl) {
    stageEl.textContent = statusKo(job.stage);
  }
  if (statusEl) {
    statusEl.textContent = statusKo(job.status);
    statusEl.classList.toggle("status-warn", APPROVAL_WAIT_STATUSES.has(job.status));
    statusEl.classList.toggle("status-bad", job.status === "failed");
    statusEl.classList.toggle("status-ok", job.status === "done");
  }
  if (emptyEl) emptyEl.classList.add("is-hidden");
}

function formatTimelineTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function eventTimestamp(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function jobTimestamp(job) {
  if (!job) return 0;
  const candidates = ["updated_at", "completed_at", "created_at"];
  for (const key of candidates) {
    if (job[key]) {
      const value = new Date(job[key]);
      if (!Number.isNaN(value.getTime())) return value.getTime();
    }
  }
  const numericId = Number(job.id);
  return Number.isNaN(numericId) ? 0 : numericId;
}

function renderTimeline(job) {
  const listEl = document.getElementById("timelineList");
  const emptyEl = document.getElementById("timelineEmptyState");
  if (!listEl) return;
  if (!job || !Array.isArray(job.timeline) || !job.timeline.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("is-hidden");
    return;
  }
  const events = [...job.timeline]
    .sort((a, b) => eventTimestamp(b.at) - eventTimestamp(a.at))
    .slice(0, 6);
  listEl.innerHTML = events
    .map(
      (event) => `
        <li class="timeline-item">
          <span class="timeline-time">${esc(formatTimelineTime(event.at))}</span>
          <p>${esc(event.message || "-")}</p>
        </li>
      `
    )
    .join("");
  if (emptyEl) emptyEl.classList.add("is-hidden");
}

function normalizeEventStage(stage) {
  const token = String(stage || "").trim().toLowerCase();
  const map = {
    pm: "pm",
    product: "pm",
    cto: "cto",
    dev: "dev",
    design: "design_review",
    ux: "design_review",
    design_review: "design_review",
    qa: "qa",
    report: "report",
    pre_approval: "pre_approval",
    post_approval: "post_approval",
  };
  return map[token] || token;
}

function collectConversationEvents(job) {
  if (!job) return [];
  const result = [];

  const timeline = Array.isArray(job.timeline) ? job.timeline : [];
  timeline.forEach((event) => {
    result.push({
      at: event.at || "",
      stage: normalizeEventStage(event.stage || job.stage || ""),
      actor: event.actor || "시스템",
      message: event.message || "",
      source: "timeline",
    });
  });

  const noteSets = [
    { key: "pm_notes", stage: "pm" },
    { key: "cto_notes", stage: "cto" },
    { key: "dev_notes", stage: "dev" },
    { key: "qa_notes", stage: "qa" },
  ];
  noteSets.forEach(({ key, stage }) => {
    const notes = Array.isArray(job[key]) ? job[key] : [];
    notes.forEach((note) => {
      const message = note.note || note.message || "";
      if (!message) return;
      result.push({
        at: note.at || "",
        stage: normalizeEventStage(note.stage || stage),
        actor: note.role || "팀",
        message,
        source: key,
      });
    });
  });

  const seen = new Set();
  return result
    .filter((event) => event.message)
    .sort((a, b) => eventTimestamp(a.at) - eventTimestamp(b.at))
    .filter((event) => {
      const key = `${event.at}|${event.actor}|${event.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderClientDigest(events, job) {
  const clientDigestList = document.getElementById("clientDigestList");
  const clientStatus = document.getElementById("clientDigestStatus");
  const clientEmpty = document.getElementById("clientDigestEmpty");
  if (!clientDigestList || !clientStatus) return;

  if (!events.length) {
    clientDigestList.innerHTML = "";
    clientStatus.textContent = "대상 이벤트가 없어 요약을 생성하지 않았습니다.";
    lastClientDigestText = "";
    if (clientEmpty) clientEmpty.classList.remove("is-hidden");
    return;
  }

  const picked = events.slice(-4).map((event) => {
    return `${statusKo(event.stage || "-")}: ${toClientFriendlyMessage(event.message, event.stage)}`;
  });
  clientDigestList.innerHTML = picked.map((line) => `<li>${esc(line)}</li>`).join("");
  lastClientDigestText = [`작업: ${job.id}`, ...picked].join("\n");
  clientStatus.textContent = "클라이언트 공유용 요약이 최신 상태입니다.";
  if (clientEmpty) clientEmpty.classList.add("is-hidden");
}

function renderConversation(job) {
  const titleEl = document.getElementById("conversationJobTitle");
  const metaEl = document.getElementById("conversationJobMeta");
  const stageEl = document.getElementById("conversationStage");
  const feedEl = document.getElementById("conversationFeed");
  const emptyEl = document.getElementById("conversationEmptyState");
  const summaryEl = document.getElementById("conversationSummary");
  const filtersEl = document.getElementById("conversationFilters");
  const clientEl = document.getElementById("conversationClient");
  const clientDigestList = document.getElementById("clientDigestList");
  const clientEmpty = document.getElementById("clientDigestEmpty");
  const clientStatus = document.getElementById("clientDigestStatus");
  if (!titleEl || !metaEl || !stageEl || !feedEl || !emptyEl || !summaryEl || !filtersEl) return;

  if (!job) {
    titleEl.textContent = "대상 작업 없음";
    metaEl.textContent = "활성 작업이 없으면 대화가 비어있습니다.";
    stageEl.textContent = "--";
    feedEl.innerHTML = "";
    emptyEl.classList.remove("is-hidden");
    summaryEl.innerHTML = `<p class=\"muted\">대화 요약을 위해 실행중인 작업이 필요합니다.</p>`;
    filtersEl.innerHTML = "";
    if (clientDigestList) clientDigestList.innerHTML = "";
    if (clientStatus) clientStatus.textContent = "";
    if (clientEmpty) clientEmpty.classList.remove("is-hidden");
    return;
  }

  titleEl.textContent = `${job.id}${job.client_name ? ` · ${job.client_name}` : ""}`;
  metaEl.textContent = describeJob(job) || "정제된 작업 내용을 확인하세요.";
  stageEl.textContent = statusKo(job.stage);

  const events = collectConversationEvents(job);

  if (!events.length) {
    feedEl.innerHTML = "";
    emptyEl.classList.remove("is-hidden");
    if (clientDigestList) clientDigestList.innerHTML = "";
    if (clientStatus) clientStatus.textContent = "대상 이벤트가 없어 요약을 생성하지 않았습니다.";
    if (clientEmpty) clientEmpty.classList.remove("is-hidden");
  } else {
    feedEl.innerHTML = events
      .map(
        (event) => `
          <li class="conversation-item">
            <strong>${esc(toClientFriendlyActor(event.actor, event.stage))}</strong>
            <small>${esc(formatTimelineTime(event.at))}</small>
            ${renderConversationLine(event)}
          </li>
        `
      )
      .join("");
    emptyEl.classList.add("is-hidden");
    renderClientDigest(events, job);
    if (clientEmpty) clientEmpty.classList.add("is-hidden");
  }

  const summaryRows = [
    ["업무 유형", job.work_type || "-"],
    ["미션", job.mission || "-"],
    ["승인 모드", job.approval_mode || "auto"],
    ["변경 파일", `${(job.changed_files || []).length}개`],
    ["실행 액션", (job.executed_actions || []).join(", ") || "-"]
  ];
  summaryEl.innerHTML = `
    <h4>작업 요약</h4>
    <ul class="summary-list">
      ${summaryRows.map(([label, value]) => `<li><span>${esc(label)}</span><strong>${esc(value)}</strong></li>`).join("")}
    </ul>
  `;

  const activeIdx = PIPELINE_STEPS.findIndex((step) => step.id === job.stage);
  filtersEl.innerHTML = `
    <div class="filter-title">단계별 진척</div>
    <ul class="filter-chips">
      ${PIPELINE_STEPS.map((step, idx) => {
        const state = activeIdx === -1 ? (idx === 0 ? "current" : "upcoming") : idx < activeIdx ? "complete" : idx === activeIdx ? "current" : "upcoming";
        return `<li class="filter-chip ${state}">${esc(step.label)}</li>`;
      }).join("")}
    </ul>
  `;

  if (clientEl) {
    clientEl.classList.toggle("is-hidden", !job);
  }
}

function renderReportHub(jobs = []) {
  const summaryRoot = document.getElementById("reportSummary");
  const evidenceRoot = document.getElementById("reportEvidence");
  if (!summaryRoot || !evidenceRoot) return;

  if (!jobs.length) {
    summaryRoot.innerHTML = `<h3>운영 요약</h3><p class="muted">집계할 작업이 없습니다.</p>`;
    evidenceRoot.innerHTML = `<h3>최근 리포트</h3><p class="muted">리포트 데이터를 가져올 작업이 없습니다.</p>`;
    return;
  }

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const waitingCount = jobs.filter((j) => APPROVAL_WAIT_STATUSES.has(j.status)).length;
  const runningCount = jobs.filter((j) => RUNNING_STATUSES.has(j.status)).length;
  summaryRoot.innerHTML = `
    <h3>운영 요약</h3>
    <div class="report-badges">
      <span class="report-badge">누적 ${esc(jobs.length)}건</span>
      <span class="report-badge">완료 ${esc(doneCount)}건</span>
      <span class="report-badge">승인 대기 ${esc(waitingCount)}건</span>
    </div>
    <ul class="report-list">
      <li>실행중: ${esc(runningCount)}건 (PM→Report 흐름 모니터링)</li>
      <li>승인 보류: ${esc(waitingCount)}건 (Owner 개입 필요)</li>
      <li>완료 누적: ${esc(doneCount)}건 (QA 증빙 포함)</li>
    </ul>
  `;

  const sorted = [...jobs].sort((a, b) => jobTimestamp(b) - jobTimestamp(a));
  const latest = sorted[0];
  const latestDoneReport = sorted.find((job) => job.status === "done" && !!job.report_path);
  const target = latestDoneReport || latest;
  const reportReady = target.status === "done" && !!target.report_path;
  const reportHint = reportReady
    ? "최근 완료 리포트를 표시중입니다."
    : `현재 상태: ${statusKo(target.status)} (${statusKo(target.stage)}) · Report 단계 완료 후 생성됩니다.`;
  const files = Array.isArray(target.changed_files) ? target.changed_files : [];
  const actions = Array.isArray(target.executed_actions) ? target.executed_actions : [];
  const qaNote = target.qa_result || target.qa_summary || "QA 결과 수집중";
  const filePreview = files.slice(0, 3).map((file) => `<code>${esc(file)}</code>`).join(", ") || "-";
  const reportHref = reportPathToHref(target.report_path);
  const reportLine = target.report_path
    ? `<a href="${esc(reportHref)}" target="_blank" rel="noopener noreferrer">${esc(target.report_path)}</a>`
    : "아직 리포트 경로가 없습니다.";
  evidenceRoot.innerHTML = `
    <h3>최근 리포트 · ${esc(target.id || "-")}</h3>
    <p class="muted">${reportLine}</p>
    <p class="muted">${esc(reportHint)}</p>
    <ul class="report-list">
      <li>변경 파일 ${esc(files.length)}개 · ${filePreview}</li>
      <li>실행 액션 ${esc(actions.length)}개 · ${esc(actions.join(", ") || "-")}</li>
      <li>QA 증빙: ${esc(qaNote)}</li>
    </ul>
  `;
}

function renderStatusMetrics(jobs = []) {
  const root = document.getElementById("statusMetrics");
  if (!root) return;
  if (!jobs.length) {
    root.innerHTML = `<p class="muted">파이프라인에 등록된 작업이 없습니다.</p>`;
    return;
  }
  let running = 0;
  let approvals = 0;
  let queued = 0;
  let failed = 0;
  jobs.forEach((job) => {
    if (APPROVAL_WAIT_STATUSES.has(job.status)) {
      approvals += 1;
    } else if (QUEUED_STATUSES.has(job.status)) {
      queued += 1;
    } else if (job.status === "failed") {
      failed += 1;
    } else if (RUNNING_STATUSES.has(job.status) || (RUNNING_STAGES.has(job.stage) && !["done", "failed"].includes(job.status))) {
      running += 1;
    }
  });

  const items = [
    { label: "실행중", value: running, helper: "파이프라인 내 진행중" },
    { label: "승인 대기", value: approvals, helper: "수동 게이트 필요" },
    { label: "대기열", value: queued, helper: "할당됨 · 시작 전" },
    { label: "실패/중단", value: failed, helper: "운영 개입 필요" }
  ];
  root.innerHTML = items
    .map(
      (item) => `
        <div class="metric-card">
          <div class="metric-value">${esc(item.value)}</div>
          <div class="metric-label">${esc(item.label)}</div>
          <p>${esc(item.helper)}</p>
        </div>
      `
    )
    .join("");
}

function renderWeeklyKpiCards(requestsPayload, jobsPayload) {
  const root = document.getElementById("weeklyKpiCards");
  if (!root) return;
  const requests = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const inWindow = (ts) => eventTimestamp(ts) >= since;

  const reqIn = requests.filter((r) => inWindow(r.created_at));
  const jobsIn = jobs.filter((j) => inWindow(j.created_at));
  const doneIn = jobsIn.filter((j) => j.status === "done");
  const failIn = jobsIn.filter((j) => j.status === "failed");

  const lead = doneIn
    .map((j) => {
      const s = eventTimestamp(j.created_at);
      const e = eventTimestamp(j.completed_at);
      if (!s || !e || e < s) return 0;
      return (e - s) / 60000;
    })
    .filter((n) => n > 0);
  const avgLead = lead.length ? Math.round((lead.reduce((a, b) => a + b, 0) / lead.length) * 10) / 10 : 0;
  const success = jobsIn.length ? Math.round((doneIn.length / jobsIn.length) * 1000) / 10 : 0;

  const items = [
    { label: "7일 요청", value: reqIn.length, helper: "최근 1주 접수" },
    { label: "7일 성공률", value: `${success}%`, helper: "done / created" },
    { label: "7일 평균 리드타임", value: `${avgLead}분`, helper: "created→completed" },
    { label: "7일 실패", value: failIn.length, helper: "재처리 대상" }
  ];
  root.innerHTML = items
    .map(
      (item) => `
        <div class="metric-card">
          <div class="metric-value">${esc(item.value)}</div>
          <div class="metric-label">${esc(item.label)}</div>
          <p>${esc(item.helper)}</p>
        </div>
      `
    )
    .join("");
}

function renderOpsQueueMetrics(queue) {
  const root = document.getElementById("opsQueueMetrics");
  if (!root || !queue) return;
  const counts = queue.counts || {};
  const blocks = [
    { label: "백로그", value: (counts.queued || 0) + (counts.dispatching || 0), helper: "queued+dispatching" },
    { label: "진행중", value: (counts.in_progress || 0) + (counts.waiting_approval || 0), helper: "in progress + approval" },
    { label: "실패", value: counts.failed || 0, helper: "retry candidates" },
    { label: "정체", value: (counts.stalled_queue || 0) + (counts.stalled_progress || 0), helper: "threshold exceeded" }
  ];
  root.innerHTML = blocks
    .map(
      (item) => `
        <div class="ops-queue-metric">
          <strong>${esc(item.value)}</strong>
          <small>${esc(item.label)}</small>
          <p class="muted">${esc(item.helper)}</p>
        </div>
      `
    )
    .join("");
}

function renderOpsQueueList(rootId, emptyId, tagId, rows = [], mode = "backlog") {
  const list = document.getElementById(rootId);
  const empty = document.getElementById(emptyId);
  const tag = document.getElementById(tagId);
  if (!list || !empty || !tag) return;
  tag.textContent = `${rows.length}건`;
  if (!rows.length) {
    list.innerHTML = "";
    empty.classList.remove("is-hidden");
    return;
  }
  list.innerHTML = rows
    .slice(0, 8)
    .map((item) => {
      const title = `${item.id} · ${statusKo(item.status || item.stage || "-")}`;
      const mission = item.mission || "미션 미입력";
      const age = mode === "failed" ? `${item.failed_age_min || 0}분 전 실패` : `${item.age_min || 0}분 경과`;
      const trailing = mode === "failed" ? (item.error || "오류 미기록") : `우선순위 ${priorityKo(item.priority)}`;
      return `
        <li>
          <strong>${esc(title)}</strong>
          <small>${esc(mission)}</small>
          <small>${esc(age)} · ${esc(trailing)}</small>
        </li>
      `;
    })
    .join("");
  empty.classList.add("is-hidden");
}

function refillOpsSelectors(queue) {
  const failedSel = document.getElementById("opsFailedJobSelect");
  const prioritySel = document.getElementById("opsPriorityJobSelect");
  if (!failedSel || !prioritySel || !queue) return;
  const failed = Array.isArray(queue.failed) ? queue.failed : [];
  const running = Array.isArray(queue.in_progress) ? queue.in_progress : [];
  const backlog = Array.isArray(queue.backlog) ? queue.backlog : [];
  refillSelectPreservingValue(
    failedSel,
    "실패 작업 선택",
    failed.map((job) => `<option value="${esc(job.id)}">${esc(job.id)} · ${esc(job.error || "-")}</option>`).join("")
  );
  refillSelectPreservingValue(
    prioritySel,
    "백로그/진행중 작업 선택",
    [...backlog, ...running]
      .map((job) => `<option value="${esc(job.id)}">${esc(job.id)} · ${esc(statusKo(job.status || "-"))}</option>`)
      .join("")
  );
}

function renderOpsQueueBoard(payload) {
  const queue = payload && payload.queue ? payload.queue : payload;
  if (!queue) return;
  opsQueueCache = queue;
  renderOpsQueueMetrics(queue);
  renderOpsQueueList("opsBacklogList", "opsBacklogEmpty", "opsBacklogTag", queue.backlog || [], "backlog");
  renderOpsQueueList("opsProgressList", "opsProgressEmpty", "opsProgressTag", queue.in_progress || [], "running");
  renderOpsQueueList("opsFailedList", "opsFailedEmpty", "opsFailedTag", queue.failed || [], "failed");
  refillOpsSelectors(queue);
}

function isJobStalled(job) {
  if (!job) return false;
  const status = String(job.status || "");
  if (["done", "failed"].includes(status)) return false;
  if (![...RUNNING_STATUSES, ...APPROVAL_WAIT_STATUSES, ...QUEUED_STATUSES].includes(status)) return false;
  const lastTs = jobTimestamp(job);
  if (!lastTs) return false;
  const minutes = (Date.now() - lastTs) / 60000;
  return minutes >= STALL_THRESHOLD_MINUTES;
}

function renderStalledMetrics(jobs, requests) {
  const metricsRoot = document.getElementById("stalledMetrics");
  if (!metricsRoot) return;
  const stalledJobs = jobs.filter(isJobStalled);
  const stalledRequests = requests.filter((req) => req.status === "received" && !req.linked_job_id && (Date.now() - eventTimestamp(req.created_at)) / 60000 >= REQUEST_STALL_MINUTES);
  const totalQueuing = jobs.filter((job) => QUEUED_STATUSES.has(job.status)).length;
  const blocks = [
    { label: "정체 작업", value: stalledJobs.length, helper: `30분+ 이벤트 정지` },
    { label: "미할당 요청", value: stalledRequests.length, helper: `20분+ 대기` },
    { label: "대기열", value: totalQueuing, helper: "큐 상태 유지" }
  ];
  metricsRoot.innerHTML = blocks
    .map((block) => `
      <div class="stalled-metric">
        <strong>${esc(block.value)}</strong>
        <small>${esc(block.label)}</small>
        <p class="muted">${esc(block.helper)}</p>
      </div>
    `)
    .join("");
}

function renderStalledJobs(jobs) {
  const list = document.getElementById("stalledJobsList");
  const empty = document.getElementById("stalledJobsEmpty");
  const tag = document.getElementById("stalledJobsTag");
  if (!list || !empty || !tag) return;
  const stalled = jobs.filter(isJobStalled);
  tag.textContent = `${stalled.length}건`;
  if (!stalled.length) {
    list.innerHTML = "";
    empty.classList.remove("is-hidden");
    return;
  }
  const rows = stalled
    .slice()
    .sort((a, b) => jobTimestamp(b) - jobTimestamp(a))
    .map((job) => {
      const minutes = Math.round((Date.now() - jobTimestamp(job)) / 60000);
      return `
        <li>
          <strong>${esc(job.id)} · ${esc(statusKo(job.stage || job.status || "-"))}</strong>
          <span class="stalled-meta">${esc(describeJob(job) || "세부 미션 미등록")}</span>
          <span class="stalled-meta">${minutes}분 정체 · ${esc(job.client_name || "내부")}</span>
        </li>
      `;
    })
    .join("");
  list.innerHTML = rows;
  empty.classList.add("is-hidden");
}

function renderStalledRequests(requests) {
  const list = document.getElementById("stalledRequestsList");
  const empty = document.getElementById("stalledRequestsEmpty");
  const tag = document.getElementById("stalledRequestsTag");
  if (!list || !empty || !tag) return;
  const stalled = requests
    .filter((req) => req.status === "received" && !req.linked_job_id)
    .filter((req) => (Date.now() - eventTimestamp(req.created_at)) / 60000 >= REQUEST_STALL_MINUTES);
  tag.textContent = `${stalled.length}건`;
  if (!stalled.length) {
    list.innerHTML = "";
    empty.classList.remove("is-hidden");
    return;
  }
  const rows = stalled
    .slice()
    .sort((a, b) => eventTimestamp(b.created_at) - eventTimestamp(a.created_at))
    .map((req) => {
      const minutes = Math.round((Date.now() - eventTimestamp(req.created_at)) / 60000);
      return `
        <li>
          <strong>${esc(req.id)} · ${esc(req.client_name || "클라이언트")}</strong>
          <span class="stalled-meta">${esc(req.raw_request || "원문 없음")}</span>
          <span class="stalled-meta">접수 후 ${minutes}분 경과</span>
        </li>
      `;
    })
    .join("");
  list.innerHTML = rows;
  empty.classList.add("is-hidden");
}

function renderStalledFlowSteps(activeJob) {
  const stepsRoot = document.getElementById("stalledFlowSteps");
  const noteRoot = document.getElementById("stalledReportNote");
  const diagRoot = document.getElementById("stalledDiagnosis");
  const recoveryRoot = document.getElementById("stalledRecoveryTemplate");
  const clientRoot = document.getElementById("stalledClientTemplate");
  const causeRoot = document.getElementById("stalledCauseHighlight");
  const causeHelper = document.getElementById("stalledCauseHelper");
  const recoveryStatus = document.getElementById("copyStatusRecovery");
  const clientStatus = document.getElementById("copyStatusClient");
  if (!stepsRoot || !noteRoot) return;
  const defaultCauseText = "정체된 작업을 선택하면 최근 이벤트와 예상 원인을 한글로 요약합니다.";
  const defaultRecoveryStatus = "감사 이벤트 detail에 붙여넣을 내용을 그대로 복사합니다.";
  const defaultClientStatus = "클라이언트 커뮤니케이션 4블록 템플릿을 한 번에 복사합니다.";
  stepsRoot.innerHTML = FLOW_STEPS.map((step) => `<li><strong>${esc(step.label)}</strong> · ${esc(step.detail)}</li>`).join("");
  if (!activeJob) {
    noteRoot.textContent = "우선 CEO 워치 대상 작업을 선택하세요. 파이프라인에서 정체된 항목을 탭하면 메모 양식이 활성화됩니다.";
    if (diagRoot) {
      diagRoot.innerHTML = `<dt>대상 작업</dt><dd>활성화된 정체 작업이 없습니다.</dd>`;
    }
    if (recoveryRoot) recoveryRoot.textContent = RECOVERY_TEMPLATE;
    if (clientRoot) clientRoot.textContent = CLIENT_TEMPLATE;
    if (causeRoot) causeRoot.textContent = defaultCauseText;
    if (causeHelper) causeHelper.textContent = "CEO 워치 영역에서 작업을 선택하면 재처리 안내가 자동으로 채워집니다.";
    if (recoveryStatus) recoveryStatus.textContent = defaultRecoveryStatus;
    if (clientStatus) clientStatus.textContent = defaultClientStatus;
  } else {
    const minutes = Math.round((Date.now() - jobTimestamp(activeJob)) / 60000);
    const lines = [
      `[요청 ID] ${activeJob.request_id || "-"} / ${activeJob.client_name || "내부"}`,
      `[작업 ID] ${activeJob.id} (${statusKo(activeJob.stage || activeJob.status)})`,
      `[정체 원인] ${minutes}분 동안 이벤트 없음 → CEO 검토 필요`,
      `[조치] 진행 재개 또는 제거 결정 · 보고서에 첨부`
    ];
    noteRoot.textContent = lines.join("\n");
    if (diagRoot) {
      const summary = extractRequestSummary(activeJob);
      const lastEvent = Array.isArray(activeJob.timeline) ? activeJob.timeline[activeJob.timeline.length - 1] : null;
      const auditSummary = renderAuditSummary(activeJob);
      const ownerState = ownerStateForJob(activeJob);
      diagRoot.innerHTML = [
        `<dt>요청 ID</dt><dd>${esc(activeJob.request_id || "-")}</dd>`,
        `<dt>작업/단계</dt><dd>${esc(activeJob.id)} · ${esc(statusKo(activeJob.stage || activeJob.status || "-"))}</dd>`,
        summary ? `<dt>요약</dt><dd>${esc(summary)}</dd>` : "",
        `<dt>마지막 이벤트</dt><dd>${esc(formatTimelineTime(lastEvent?.at))} · ${esc(lastEvent?.message || "기록 없음")}</dd>`,
        `<dt>감사 로그</dt><dd>${esc(auditSummary)}</dd>`,
        ownerState ? `<dt>Owner ID 상태</dt><dd class="${ownerState.isRisk ? "is-risk" : ""}">${esc(ownerState.text)}</dd>` : ""
      ]
        .filter(Boolean)
        .join("");
    }
    if (recoveryRoot) {
      recoveryRoot.textContent = buildRecoveryTemplate(activeJob);
    }
    if (clientRoot) {
      clientRoot.textContent = buildClientTemplate(activeJob);
    }
    if (causeRoot) {
      const timeline = Array.isArray(activeJob.timeline) ? activeJob.timeline : [];
      const lastEvent = timeline[timeline.length - 1];
      const causeLines = [
        `[단계] ${statusKo(activeJob.stage || activeJob.status || "-")} · 우선순위 ${priorityKo(activeJob.priority)}`,
        `[최근 이벤트] ${formatTimelineTime(lastEvent?.at) || "기록 없음"} · ${lastEvent?.message || "메시지 없음"}`,
        `[정체 시간] ${minutes}분 경과 · 즉시 재처리 필요`
      ];
      causeRoot.textContent = causeLines.join("\n");
    }
    if (causeHelper) {
      causeHelper.textContent = "요약을 복사해 감사로그 또는 리포트 메모에 즉시 반영하세요.";
    }
    if (recoveryStatus) {
      recoveryStatus.textContent = "복사 후 audit_events.detail.recovery 항목에 붙여넣으세요.";
    }
    if (clientStatus) {
      clientStatus.textContent = "복사 후 클라이언트 응대 초안에 붙여넣어 공유하세요.";
    }
  }
}

function isLocalTrustJob(job, request) {
  if (!job) return false;
  const requestText = request?.raw_request || "";
  const noteText = job.refined_request || "";
  const base = `${job.mission || ""} ${job.work_type || ""} ${noteText} ${requestText}`.toLowerCase();
  return LOCAL_TRUST_KEYWORDS.some((keyword) => base.includes(keyword));
}

function describeRecoveryReason(event, job) {
  if (!job) return "";
  if (!event) return `${statusKo(job.stage || job.status || "-")} 단계 정체 감시중`;
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (detail.reason === "stalled_timeout_recovery") return "60분 초과 이벤트 부재";
  if (detail.reason) return detail.reason;
  return `${statusKo(job.stage || job.status || "-")} 단계 정체`;
}

function describeRecoveryAction(event, job) {
  if (!event) return "PM→CTO→Dev 재기동 + Owner Local Trust 확인";
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (detail.action === "job_failed_request_requeued") return "정체 작업 종료 → 요청 재큐잉 → 파이프라인 재시작";
  if (detail.action) return detail.action;
  return "정체 원인 기록 후 Dev 단계 재시작";
}

function buildLocalTrustAuditNote(job, request, recoveryEvent) {
  if (!job) return "";
  const client = request?.client_name || job.client_name || "클라이언트";
  const timeline = Array.isArray(job.timeline) ? job.timeline : [];
  const lastEvent = timeline[timeline.length - 1];
  const stageLabel = statusKo(job.stage || job.status || "-");
  const reason = describeRecoveryReason(recoveryEvent, job);
  const action = describeRecoveryAction(recoveryEvent, job);
  const recoveryAt = recoveryEvent ? formatDateTimeFull(recoveryEvent.at) : "미기록";
  return [
    `[요청 ID] ${job.request_id || "-"} / ${client}`,
    `[작업 ID] ${job.id} (${stageLabel})`,
    `[정체 원인] ${reason}`,
    `[재처리 경로] ${action}`,
    `[감사 이벤트] ${recoveryAt}`,
    `[마지막 이벤트] ${formatTimelineTime(lastEvent?.at) || "--"} · ${lastEvent?.message || "타임라인 미기록"}`
  ].join("\n");
}

function buildLocalTrustClientNote(job, request, recoveryEvent) {
  if (!job) return "";
  const client = request?.client_name || job.client_name || "클라이언트";
  const mission = job.mission || "Local Trust 미션 재가동";
  const summary = extractRequestSummary(job) || request?.raw_request || "요약 미입력";
  const riskLine = recoveryEvent ? "- 정체 복구 반복 시 CTO/CEO 즉시 에스컬레이션" : "- 장기 정체 발생 시 manual 승인 대기 가능";
  return `[변경점]
- ${mission} 재시작 (${summary})
[영향]
- ${client} 전달 일정 30분 지연 (정체 복구 중)
[리스크]
${riskLine}
[다음 조치]
- Owner Local Trust 설정 재확인 → Dev 단계 재실행 → 감사/리포트 업데이트`;
}

function collectLocalTrustCases(jobs = [], requests = [], auditEvents = []) {
  if (!jobs.length) return [];
  const requestMap = new Map(requests.map((req) => [String(req.id), req]));
  return jobs
    .filter((job) => isLocalTrustJob(job, requestMap.get(String(job.request_id)) || findRequestById(job.request_id)))
    .map((job) => {
      const request = requestMap.get(String(job.request_id)) || findRequestById(job.request_id);
      const relatedEvents = auditEvents
        .filter(
          (event) =>
            event.kind === "job_stalled_recovered" &&
            (String(event.request_id || "") === String(job.request_id || "") || extractAuditJobIds(event).includes(String(job.id || "")))
        )
        .sort((a, b) => eventTimestamp(b.at) - eventTimestamp(a.at));
      const latestRecovery = relatedEvents[0] || null;
      return {
        job,
        request,
        latestRecovery,
        recoveryCount: relatedEvents.length,
        auditText: buildLocalTrustAuditNote(job, request, latestRecovery),
        clientText: buildLocalTrustClientNote(job, request, latestRecovery)
      };
    })
    .sort((a, b) => jobTimestamp(b.job) - jobTimestamp(a.job));
}

function renderLocalTrustMetrics(cases) {
  if (!cases.length) return "";
  const recovered = cases.filter((entry) => entry.recoveryCount > 0).length;
  const running = cases.filter((entry) => !["done", "failed"].includes(entry.job.status)).length;
  const metrics = [
    { label: "감시중", value: cases.length, helper: "Local Trust 미션" },
    { label: "재처리 이력", value: recovered, helper: "job_stalled_recovered" },
    { label: "진행중", value: running, helper: "Dev→Report 흐름" }
  ];
  return metrics
    .map(
      (item) => `
      <div class="local-trust-metric">
        <strong>${esc(item.value)}</strong>
        <small>${esc(item.label)}</small>
        <p>${esc(item.helper)}</p>
      </div>
    `
    )
    .join("");
}

function renderLocalTrustCase(entry) {
  const { job, request, latestRecovery, auditText, clientText } = entry;
  const client = request?.client_name || job.client_name || "클라이언트";
  const stageLabel = statusKo(job.stage || job.status || "-");
  const statusLabel = statusKo(job.status);
  const timeline = Array.isArray(job.timeline) ? job.timeline : [];
  const lastEvent = timeline[timeline.length - 1];
  const causeText = describeRecoveryReason(latestRecovery, job);
  const actionText = describeRecoveryAction(latestRecovery, job);
  const eventText = lastEvent ? `${formatTimelineTime(lastEvent.at)} · ${lastEvent.message}` : "최근 이벤트 없음";
  const auditNoteId = safeDomId("localTrustAudit", job.id);
  const auditStatusId = `${auditNoteId}-status`;
  const clientNoteId = safeDomId("localTrustClient", job.id);
  const clientStatusId = `${clientNoteId}-status`;
  return `
    <article class="local-trust-card">
      <header>
        <div>
          <p class="eyebrow">${esc(client)} · ${esc(job.request_id || "-")}</p>
          <h4>${esc(job.mission || job.work_type || "Local Trust 작업")}</h4>
        </div>
        <div class="local-trust-tags">
          <span class="tag">${esc(stageLabel)}</span>
          <span class="tag">${esc(statusLabel)}</span>
        </div>
      </header>
      <div class="local-trust-highlights">
        <div>
          <p class="eyebrow">정체 원인</p>
          <p class="local-trust-text">${esc(causeText)}</p>
        </div>
        <div>
          <p class="eyebrow">재처리 경로</p>
          <p class="local-trust-text">${esc(actionText)}</p>
        </div>
        <div>
          <p class="eyebrow">최근 이벤트</p>
          <p class="local-trust-text">${esc(eventText)}</p>
        </div>
      </div>
      <div class="local-trust-templates">
        <section>
          <div class="template-header">
            <p class="eyebrow">감사 기록 템플릿</p>
            <button type="button" class="copy-btn" data-copy-target="${esc(auditNoteId)}" data-status-target="${esc(auditStatusId)}">복사</button>
          </div>
          <pre id="${esc(auditNoteId)}" class="stalled-note">${esc(auditText)}</pre>
          <p class="copy-status muted" id="${esc(auditStatusId)}">감사 이벤트 detail에 붙여넣으세요.</p>
        </section>
        <section>
          <div class="template-header">
            <p class="eyebrow">클라이언트 응대 템플릿</p>
            <button type="button" class="copy-btn" data-copy-target="${esc(clientNoteId)}" data-status-target="${esc(clientStatusId)}">복사</button>
          </div>
          <pre id="${esc(clientNoteId)}" class="stalled-note">${esc(clientText)}</pre>
          <p class="copy-status muted" id="${esc(clientStatusId)}">4블록 템플릿으로 바로 전달하세요.</p>
        </section>
      </div>
    </article>
  `;
}

function renderLocalTrustBoard(jobsPayload, requestsPayload, auditPayload) {
  const board = document.getElementById("localTrustBoard");
  const casesRoot = document.getElementById("localTrustCases");
  const metricsRoot = document.getElementById("localTrustMetrics");
  const emptyEl = document.getElementById("localTrustEmpty");
  if (!board || !casesRoot || !metricsRoot || !emptyEl) return;
  const requests = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const auditEvents = Array.isArray(auditPayload?.events) ? auditPayload.events : [];
  const cases = collectLocalTrustCases(jobs, requests, auditEvents);
  if (!cases.length) {
    board.classList.add("is-hidden");
    casesRoot.innerHTML = "";
    metricsRoot.innerHTML = "";
    emptyEl.classList.remove("is-hidden");
    return;
  }
  board.classList.remove("is-hidden");
  emptyEl.classList.add("is-hidden");
  metricsRoot.innerHTML = renderLocalTrustMetrics(cases);
  casesRoot.innerHTML = cases.map((entry) => renderLocalTrustCase(entry)).join("");
}

function renderAuditSummary(job) {
  const events = getAuditEventsForJob(job);
  if (!events.length) return "감사 이벤트 없음";
  const latest = events[events.length - 1];
  return `${formatDateTimeFull(latest.at)} · ${latest.kind}`;
}

function buildRecoveryTemplate(job) {
  const timeline = Array.isArray(job.timeline) ? job.timeline : [];
  const lastEvent = timeline[timeline.length - 1];
  const stage = statusKo(job.stage || job.status || "-");
  const summary = extractRequestSummary(job);
  return `1) 정체 원인: ${summary || lastEvent?.message || stage} 단계에서 멈춤
2) 즉시 조치: PM/CTO/Dev 이벤트 강제 재기록, 승인 상태 확인
3) 필요 승인/검증: ${job.approval_mode || "auto"} · QA 재검토 필요 여부 확인
4) 재시도 타임라인: ${new Date().toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 재기동 → 30분 후 상태 점검`;
}

function buildClientTemplate(job) {
  const mission = job.mission || job.work_type || "작업 진행";
  const client = job.client_name || "클라이언트";
  const summary = extractRequestSummary(job);
  const riskLine =
    summary && summary.toLowerCase().includes("owner")
      ? "- Owner ID 누락 재발 시 즉시 차단 및 운영자 설정 재검증 필요"
      : "- Dev 단계 장기 정체 시 승인/QA 일정 추가 지연 가능";
  return `[변경점]
- ${mission} 재시작 준비 (${summary || "요청 요약 미기록"})
[영향]
- ${client} 전달 일정 약 30분 지연 예상
[리스크]
${riskLine}
[다음 조치]
- OWNER 설정 확인 → Dev 단계 재개 → 감사로그/리포트 업데이트 후 공유`;
}

function getAuditEventsForJob(job) {
  if (!job) return [];
  const events = Array.isArray(tableCache.audit?.events) ? tableCache.audit.events : [];
  if (!events.length) return [];
  const jobId = String(job.id || "");
  const requestId = String(job.request_id || "");
  return events
    .filter((event) => {
      const jobIds = extractAuditJobIds(event);
      const matchesJob = jobId && jobIds.includes(jobId);
      const matchesRequest = requestId && String(event.request_id || "") === requestId;
      return matchesJob || matchesRequest;
    })
    .sort((a, b) => eventTimestamp(a.at) - eventTimestamp(b.at));
}

function extractRequestSummary(job) {
  const note = String(job?.refined_request || "");
  const match = note.match(/\[요약\]\s*(.+)/i);
  return match ? match[1].trim() : "";
}

function ownerStateForJob(job) {
  if (!job) return null;
  const request = findRequestById(job.request_id);
  const normalize = (value) => String(value || "").trim();
  const jobOwner = normalize(job.owner_id);
  const requestOwner = normalize(request?.owner_id);
  const currentOwner = normalize(document.getElementById("ownerId")?.value);
  const label = (value) => (value ? value : "미입력");
  let isRisk = false;
  let text = "";

  if (!jobOwner && !requestOwner && !currentOwner) {
    text = "요청/작업/입력 모두 Owner ID 미입력";
    isRisk = true;
  } else if (!currentOwner) {
    text = `입력값 없음 · 요청=${label(requestOwner)} · 작업=${label(jobOwner)}`;
    isRisk = true;
  } else if ((jobOwner && jobOwner !== currentOwner) || (requestOwner && requestOwner !== currentOwner)) {
    text = `입력=${label(currentOwner)} · 요청=${label(requestOwner)} · 작업=${label(jobOwner)}`;
    isRisk = true;
  } else {
    const resolved = currentOwner || jobOwner || requestOwner || "미입력";
    text = `일치 (${resolved})`;
  }

  return { text, isRisk };
}

function renderJobsKanban(jobs = []) {
  const root = document.getElementById("jobsKanban");
  if (!root) return;
  if (!jobs.length) {
    root.innerHTML = `<p class="muted">칸반에 표시할 작업이 없습니다.</p>`;
    return;
  }

  const columns = [
    { key: "backlog", title: "백로그", statuses: ["queued", "dispatching"] },
    { key: "active", title: "진행중", statuses: ["in_progress", "waiting_pre_approval", "waiting_post_approval"] },
    { key: "done", title: "완료", statuses: ["done"] },
    { key: "failed", title: "실패", statuses: ["failed"] }
  ];

  root.innerHTML = columns
    .map((column) => {
      const items = jobs
        .filter((job) => column.statuses.includes(job.status))
        .sort((a, b) => {
          const p = priorityOrder(a.priority) - priorityOrder(b.priority);
          if (p !== 0) return p;
          return eventTimestamp(b.created_at) - eventTimestamp(a.created_at);
        });
      return `
        <article class="kanban-column">
          <header>
            <strong>${esc(column.title)}</strong>
            <span class="tag">${esc(items.length)}건</span>
          </header>
          <div class="kanban-list">
            ${
              items.length
                ? items
                    .map(
                      (job) => `
                        <div class="kanban-card ${priorityClass(job.priority)}">
                          <div class="kanban-card-top">
                            <code>${esc(job.id)}</code>
                            <span class="tag ${priorityClass(job.priority)}">${esc(priorityKo(job.priority))}</span>
                          </div>
                          <p>${esc(job.mission || job.work_type || "-")}</p>
                          <small>${esc(shortRepoName(job.repository))} · ${esc(statusKo(job.stage || "-"))}</small>
                        </div>
                      `
                    )
                    .join("")
                : `<p class="muted">작업 없음</p>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderJobs(payload) {
  tableCache.jobs = payload;
  const originalJobs = payload.jobs || [];
  const jobs = [...originalJobs].sort((a, b) => jobTimestamp(b) - jobTimestamp(a));
  const root = document.getElementById("jobsTable");
  if (!jobs.length) {
    root.innerHTML = `<p class="muted">할당된 작업이 없습니다.</p>`;
    renderPaginationControls("jobs", { page: 1, totalPages: 1, totalItems: 0 });
  } else {
    const pagination = applyPagination("jobs", jobs);
    const rows = pagination.pageItems;
    root.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead>
          <tr><th>작업 ID</th><th>생성 시각</th><th>완료 시각</th><th>우선순위</th><th>상태</th><th>단계</th><th>저장소</th><th>승인 모드</th><th>실행 액션</th><th>변경 파일 수</th><th>리포트</th></tr>
        </thead>
        <tbody>
          ${rows.map((j) => {
            const approval = j.approval_mode || "auto";
            const actions = esc((j.executed_actions || []).join(", ") || "-");
            const changed = (j.changed_files || []).length;
            const reportHref = reportPathToHref(j.report_path);
            const report = j.report_path
              ? `<a href="${esc(reportHref)}" target="_blank" rel="noopener noreferrer"><code>${esc(j.report_path)}</code></a>`
              : "-";
            return `<tr><td><code>${esc(j.id)}</code></td><td>${esc(formatDateTimeFull(j.created_at))}</td><td>${esc(formatDateTimeFull(j.completed_at))}</td><td><span class="tag ${priorityClass(j.priority)}">${esc(priorityKo(j.priority))}</span></td><td><span class="tag">${esc(statusKo(j.status))}</span></td><td>${esc(statusKo(j.stage || "-"))}</td><td><code>${esc(shortRepoName(j.repository))}</code></td><td>${esc(approval)}</td><td>${actions}</td><td>${changed}</td><td>${report}</td></tr>`;
          }).join("")}
        </tbody>
      </table></div>`;
    renderPaginationControls("jobs", pagination);
  }

  const approveJobSelect = document.getElementById("approveJobSelect");
  refillSelectPreservingValue(
    approveJobSelect,
    "승인 대기 작업 선택",
    jobs
    .filter((j) => j.status === "waiting_pre_approval" || j.status === "waiting_post_approval")
    .map((j) => `<option value="${esc(j.id)}">${esc(j.id)} | ${esc(j.status)}</option>`)
    .join("")
  );

  const activeJob = pickActiveJob(originalJobs);
  renderPipeline(activeJob);
  renderTimeline(activeJob);
  renderStatusMetrics(originalJobs);
  renderStalledMetrics(originalJobs, tableCache.requests?.requests || []);
  renderStalledJobs(originalJobs);
  renderStalledRequests(tableCache.requests?.requests || []);
  renderStalledFlowSteps(activeJob && isJobStalled(activeJob) ? activeJob : null);
  renderConversation(activeJob);
  renderReportHub(originalJobs);
  renderJobsKanban(originalJobs);
}

function renderPolicy(data) {
  const root = document.getElementById("policyInfo");
  if (!root) return;
  const lines = (data.repositories || []).map((r) => {
    const actions = (r.allowed_actions || []).join(", ") || "-";
    const writable = (r.writable_paths || []).join(", ") || "-";
    return `<div><code>${esc(r.path)}</code> | 허용 액션: ${esc(actions)} | 수정 허용 경로: ${esc(writable)}</div>`;
  });
  const nextHtml = `<div>기본 승인 모드: <strong>${esc(data.default_approval_mode || "auto")}</strong></div>${lines.join("")}`;
  if (nextHtml === lastPolicySnapshotHtml) return;
  root.innerHTML = nextHtml;
  lastPolicySnapshotHtml = nextHtml;
}

function renderPreflightSummary(preflight) {
  const root = document.getElementById("preflightSummary");
  if (!root) return;
  if (!preflight || typeof preflight !== "object") {
    root.innerHTML = `<p class="muted">Preflight 정보를 불러오지 못했습니다.</p>`;
    return;
  }
  const issues = Array.isArray(preflight.issues) ? preflight.issues : [];
  const cls = preflight.ok ? "status-ok" : "status-bad";
  root.innerHTML = `
    <h4>Codex Preflight</h4>
    <p><span class="tag ${cls}">${preflight.ok ? "정상" : "주의"}</span> 실행모드: ${esc(preflight.execution_mode || "-")}</p>
    <p class="muted">bin: ${esc(preflight.codex_bin || "-")} · model: ${esc(preflight.codex_model || "-")}</p>
    <ul>
      ${issues.length ? issues.map((x) => `<li>${esc(x)}</li>`).join("") : "<li>이슈 없음</li>"}
    </ul>
  `;
}

function pickDefaultRepoPath() {
  if (!Array.isArray(reposCache) || !reposCache.length) return "";
  return reposCache[0]?.path || "";
}

async function resolveRepositorySelection() {
  const select = document.getElementById("repoSelect");
  let repository = (select?.value || "").trim();
  if (repository) return repository;

  // Try one lazy refresh in case repository list has not been loaded yet.
  if (!Array.isArray(reposCache) || !reposCache.length) {
    try {
      await loadRepositories();
    } catch (_error) {
      // Keep graceful fallback below.
    }
  }

  repository = (select?.value || "").trim() || pickDefaultRepoPath();
  if (repository && select && !select.value) {
    select.value = repository;
  }
  return repository;
}

function applyAuditFilter(events = []) {
  return events.filter((event) => {
    const kind = String(event.kind || "");
    const owner = String(event.owner_id || "");
    const jobIds = extractAuditJobIds(event);
    const requestId = String(event.request_id || "");
    const details = JSON.stringify(event || {});
    const text = `${kind} ${owner} ${jobIds.join(" ")} ${requestId} ${details}`.toLowerCase();
    const kindOk = auditFilterState.kind === "all" || kind === auditFilterState.kind;
    const queryOk = !auditFilterState.q || text.includes(auditFilterState.q);
    const jobOk = !auditFilterState.job_id || jobIds.some((id) => String(id).toLowerCase().includes(auditFilterState.job_id));
    const requestOk = !auditFilterState.request_id || requestId.toLowerCase().includes(auditFilterState.request_id);
    return kindOk && queryOk && jobOk && requestOk;
  });
}

function extractAuditJobIds(event) {
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  const nestedJob = detail?.job && typeof detail.job === "object" ? detail.job : {};
  const candidates = [
    event?.job_id,
    detail?.job_id,
    detail?.jobId,
    nestedJob?.id,
    nestedJob?.job_id,
    nestedJob?.jobId,
  ];
  const seen = new Set();
  return candidates
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function highlightAuditValue(value, query) {
  const raw = String(value || "-");
  if (!query) return esc(raw);
  const lower = raw.toLowerCase();
  const index = lower.indexOf(query);
  if (index === -1) return esc(raw);
  const before = esc(raw.slice(0, index));
  const hit = esc(raw.slice(index, index + query.length));
  const after = esc(raw.slice(index + query.length));
  return `${before}<mark class="audit-hit">${hit}</mark>${after}`;
}

function syncAuditQuickFilters() {
  const buttons = Array.from(document.querySelectorAll("#auditQuickFilters button[data-kind]"));
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.kind === auditFilterState.kind);
  });
}

function renderAudit(payload) {
  tableCache.audit = payload;
  const allEvents = [...(payload.events || [])].sort((a, b) => eventTimestamp(b.at) - eventTimestamp(a.at));
  const events = applyAuditFilter(allEvents);
  syncAuditQuickFilters();
  const statsEl = document.getElementById("auditFilterStats");
  if (statsEl) {
    const kindLabel = auditFilterState.kind === "all" ? "전체" : auditFilterState.kind;
    const qLabel = auditFilterState.q ? `, 검색어="${auditFilterState.q}"` : "";
    const jobLabel = auditFilterState.job_id ? `, job="${auditFilterState.job_id}"` : "";
    const reqLabel = auditFilterState.request_id ? `, req="${auditFilterState.request_id}"` : "";
    const total = Number(payload.total || allEvents.length || 0);
    statsEl.textContent = `필터: ${kindLabel}${qLabel}${jobLabel}${reqLabel} · ${events.length} / 조회 ${allEvents.length}건 (전체 ${total}건)`;
  }
  const root = document.getElementById("auditTable");
  if (!events.length) {
    root.innerHTML = `<p class="audit-empty">${auditFilterState.q || auditFilterState.kind !== "all" ? "조건에 맞는 감사 로그가 없습니다. 필터를 초기화해 보세요." : "감사 로그 이벤트가 없습니다."}</p>`;
    renderPaginationControls("audit", { page: 1, totalPages: 1, totalItems: 0 });
    return;
  }
  const pagination = applyPagination("audit", events);
  const rows = pagination.pageItems;
  const query = auditFilterState.q;
  root.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>시각</th><th>종류</th><th>운영자</th><th>작업</th><th>요청</th><th>상세</th></tr></thead>
      <tbody>
        ${rows.map((e) => {
          const jobIds = extractAuditJobIds(e);
          const jobLabel = jobIds.length ? jobIds.join(", ") : "-";
          return `<tr><td>${highlightAuditValue(formatDateTimeFull(e.at), query)}</td><td>${highlightAuditValue(e.kind || "-", query)}</td><td>${highlightAuditValue(e.owner_id || "-", query)}</td><td>${highlightAuditValue(jobLabel, query)}</td><td>${highlightAuditValue(e.request_id || "-", query)}</td><td class="audit-detail"><pre><code>${escapeHtml(JSON.stringify(e, null, 2))}</code></pre></td></tr>`;
        }).join("")}
      </tbody>
    </table></div>`;
  renderPaginationControls("audit", pagination);
}

function refreshStalledDiagnostics() {
  const activeJob = pickActiveJob(tableCache.jobs?.jobs || []);
  renderStalledFlowSteps(activeJob && isJobStalled(activeJob) ? activeJob : null);
}

function hasTemplateSections(text) {
  const note = String(text || "");
  return ["[변경점]", "[영향]", "[리스크]", "[다음 조치]"].every((x) => note.includes(x));
}

function renderExecutionAudit(requestsPayload, jobsPayload, auditPayload) {
  const summaryRoot = document.getElementById("execAuditSummary");
  const tableRoot = document.getElementById("execAuditTable");
  if (!summaryRoot || !tableRoot) return;

  const requests = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const events = Array.isArray(auditPayload?.events) ? auditPayload.events : [];
  const jobsByRequest = new Map(jobs.map((job) => [String(job.request_id), job]));

  const rows = requests
    .slice()
    .sort((a, b) => eventTimestamp(b.created_at) - eventTimestamp(a.created_at))
    .map((req) => {
      const requestId = String(req.id);
      const job = jobsByRequest.get(requestId);
      const reqEvents = events.filter((e) => String(e.request_id || "") === requestId);
      const hasAssigned = reqEvents.some((e) => e.kind === "job_assigned");
      const hasDone = reqEvents.some((e) => e.kind === "job_done");
      const hasFailed = reqEvents.some((e) => e.kind === "job_failed");
      const hasPostAudit = reqEvents.some((e) => e.kind === "post_job_audit");
      const hasClientPrepared = reqEvents.some((e) => e.kind === "client_message_prepared");
      const hasResponded = reqEvents.some((e) => e.kind === "client_responded");
      const hasReport = !!job?.report_path;
      const hasResponseTemplate = hasTemplateSections(req.response_note);

      const checks = [
        hasAssigned,
        hasDone || hasFailed,
        hasReport || hasFailed,
        hasPostAudit || hasFailed,
        hasClientPrepared || hasResponded || hasResponseTemplate || hasFailed,
      ];
      const passed = checks.filter(Boolean).length;
      const score = Math.round((passed / checks.length) * 100);

      const gaps = [];
      if (!hasAssigned) gaps.push("할당 로그 없음");
      if (!(hasDone || hasFailed)) gaps.push("종료 로그 없음");
      if (!hasReport && !hasFailed) gaps.push("리포트 누락");
      if (!hasPostAudit && !hasFailed) gaps.push("완료 후 감사 누락");
      if (!(hasClientPrepared || hasResponded || hasResponseTemplate) && !hasFailed) gaps.push("클라이언트 응대 근거 부족");

      return {
        request: req,
        job,
        hasFailed,
        score,
        gaps,
        status: hasFailed ? "위험" : score === 100 ? "정상" : score >= 60 ? "주의" : "위험",
      };
    });

  const total = rows.length;
  const healthy = rows.filter((r) => r.status === "정상").length;
  const warn = rows.filter((r) => r.status === "주의").length;
  const bad = rows.filter((r) => r.status === "위험").length;
  const avg = total ? Math.round(rows.map((r) => r.score).reduce((a, b) => a + b, 0) / total) : 0;

  summaryRoot.innerHTML = [
    { label: "요청 수", value: total, helper: "감사 대상" },
    { label: "정상", value: healthy, helper: "전 흐름 추적 가능" },
    { label: "주의", value: warn, helper: "일부 증적 누락" },
    { label: "위험", value: bad, helper: "실패/핵심 누락" },
    { label: "평균 투명성", value: `${avg}%`, helper: "요청 단위 점수" },
  ]
    .map(
      (item) => `
      <div class="metric-card">
        <div class="metric-value">${esc(item.value)}</div>
        <div class="metric-label">${esc(item.label)}</div>
        <p>${esc(item.helper)}</p>
      </div>
    `
    )
    .join("");

  if (!rows.length) {
    tableRoot.innerHTML = `<p class="muted">감사할 요청 데이터가 없습니다.</p>`;
    return;
  }

  tableRoot.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead>
        <tr><th>요청</th><th>클라이언트</th><th>작업</th><th>상태</th><th>투명성 점수</th><th>누락/이슈</th></tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const statusClassName = row.status === "정상" ? "status-ok" : row.status === "주의" ? "status-warn" : "status-bad";
            const jobId = row.job?.id ? `<code>${esc(row.job.id)}</code>` : "-";
            const gaps = row.gaps.length ? row.gaps.join(", ") : "없음";
            return `<tr><td><code>${esc(row.request.id)}</code></td><td>${esc(row.request.client_name || "-")}</td><td>${jobId}</td><td><span class="tag ${statusClassName}">${esc(row.status)}</span></td><td>${esc(row.score)}%</td><td>${esc(gaps)}</td></tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  `;
}

function checkStatusTag(ok) {
  if (ok) return `<span class="tag status-ok">정상</span>`;
  return `<span class="tag status-warn">보완 필요</span>`;
}

function renderMarketBrief() {
  const root = document.getElementById("marketBrief");
  if (!root) return;
  root.innerHTML = `
    <div class="market-brief-header">
      <div>
        <p class="eyebrow">시장 브리핑 (공식 지표)</p>
        <h3>디자인팀이 참고하는 최신 경제 지표</h3>
      </div>
      <span class="tag">최종 업데이트: 2026-02-21</span>
    </div>
    <div class="market-brief-grid">
      ${MARKET_INTELLIGENCE.map((item) => `
        <article class="market-card">
          <strong>${esc(item.metric)}</strong>
          <div class="market-value">${esc(item.value)}</div>
          <p>${esc(item.detail)}</p>
          <p class="market-impact"><strong>UX 반영:</strong> ${esc(item.impact)}</p>
          <a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">출처 보기 (${esc(item.released_at)})</a>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDesignReview(statePayload, requestsPayload, jobsPayload, auditPayload) {
  const summaryRoot = document.getElementById("designReviewSummary");
  const designOpsRoot = document.getElementById("designOpsStatus");
  const tableRoot = document.getElementById("designReviewTable");
  if (!summaryRoot || !designOpsRoot || !tableRoot) return;

  const requests = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const audits = Array.isArray(auditPayload?.events) ? auditPayload.events : [];
  const agents = Array.isArray(statePayload?.agents) ? statePayload.agents : [];

  const doneJobs = jobs.filter((j) => j.status === "done");
  const doneWithReport = doneJobs.filter((j) => !!j.report_path).length;
  const postAuditCount = audits.filter((a) => a.kind === "post_job_audit").length;
  const clientTemplateCount = requests.filter((r) => hasTemplateSections(r.response_note)).length;
  const hasSecurityTeam = agents.some((a) => String(a.team || "").toLowerCase() === "security");
  const hasDesignTeam = agents.some((a) => String(a.team || "").toLowerCase() === "design");
  const designJobs = jobs.filter((job) => {
    const text = `${job.work_type || ""} ${job.mission || ""} ${job.refined_request || ""}`.toLowerCase();
    return /design|ux|ui|디자인|사용성/.test(text);
  });
  const designDone = designJobs.filter((job) => job.status === "done").length;
  const designActive = designJobs.filter((job) => !["done", "failed"].includes(job.status)).length;
  const latestDesignJob = [...designJobs].sort((a, b) => jobTimestamp(b) - jobTimestamp(a))[0];

  const checks = [
    {
      name: "디자인팀 운영 활성화",
      ok: hasDesignTeam,
      evidence: hasDesignTeam ? "Design 팀 상태 확인됨" : "Design 팀 상태 미확인",
      action: "agent_status에 Design Ops 운영 상태 확인",
    },
    {
      name: "보안팀 협업 준비",
      ok: hasSecurityTeam,
      evidence: hasSecurityTeam ? "Security 팀 상태 확인됨" : "Security 팀 상태 미확인",
      action: "Security Ops 팀 문서/시드 반영 후 파이프라인 참여 확인",
    },
    {
      name: "리포트 증적 확보",
      ok: doneJobs.length === 0 ? true : doneWithReport === doneJobs.length,
      evidence: `완료 ${doneJobs.length}건 중 리포트 ${doneWithReport}건`,
      action: "Report 단계 누락 작업 재점검",
    },
    {
      name: "완료 후 감사 생성",
      ok: doneJobs.length === 0 ? true : postAuditCount >= doneJobs.length,
      evidence: `post_job_audit ${postAuditCount}건`,
      action: "서버 재기동 후 완료 작업 1건 실행해 post_job_audit 생성 확인",
    },
    {
      name: "클라이언트 한글 템플릿 응대",
      ok: clientTemplateCount > 0,
      evidence: `4블록 템플릿 응답 ${clientTemplateCount}건`,
      action: "응대 시 [변경점/영향/리스크/다음 조치] 템플릿 사용",
    },
  ];

  const pass = checks.filter((c) => c.ok).length;
  const score = Math.round((pass / checks.length) * 100);
  const caution = checks.length - pass;
  const latestRelease = [...MARKET_INTELLIGENCE]
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())[0];

  summaryRoot.innerHTML = [
    { label: "디자인 점검 점수", value: `${score}%`, helper: "전 페이지 UX 운영 준비도" },
    { label: "통과 항목", value: pass, helper: "정상 운영 기준 충족" },
    { label: "보완 항목", value: caution, helper: "즉시 개선 필요" },
  ]
    .map(
      (item) => `
      <div class="metric-card">
        <div class="metric-value">${esc(item.value)}</div>
        <div class="metric-label">${esc(item.label)}</div>
        <p>${esc(item.helper)}</p>
      </div>
    `
    )
    .join("");

  designOpsRoot.innerHTML = [
    {
      label: "디자인 관련 작업",
      value: `${designJobs.length}건`,
      helper: `진행중 ${designActive}건 · 완료 ${designDone}건`
    },
    {
      label: "최근 디자인 태스크",
      value: latestDesignJob ? String(latestDesignJob.id) : "-",
      helper: latestDesignJob ? (latestDesignJob.mission || latestDesignJob.work_type || "세부 미션 없음") : "아직 생성된 디자인 태스크 없음"
    },
    {
      label: "최신 시장 지표 릴리스",
      value: latestRelease ? latestRelease.released_at : "-",
      helper: latestRelease ? latestRelease.metric : "시장 지표 미등록"
    }
  ]
    .map(
      (item) => `
      <div class="metric-card">
        <div class="metric-value">${esc(item.value)}</div>
        <div class="metric-label">${esc(item.label)}</div>
        <p>${esc(item.helper)}</p>
      </div>
    `
    )
    .join("");

  renderMarketBrief();

  tableRoot.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>점검 항목</th><th>상태</th><th>근거</th><th>다음 조치</th></tr></thead>
      <tbody>
        ${checks
          .map((check) => `<tr><td>${esc(check.name)}</td><td>${checkStatusTag(check.ok)}</td><td>${esc(check.evidence)}</td><td>${esc(check.action)}</td></tr>`)
          .join("")}
      </tbody>
    </table></div>
  `;
}

async function submitDesignTask(event) {
  event.preventDefault();
  const resultEl = document.getElementById("designTaskResult");
  const memo = document.getElementById("designTaskMemo").value.trim();
  const approvalMode = document.getElementById("approvalMode").value || "manual_post";
  const repository = await resolveRepositorySelection();
  if (!repository) {
    resultEl.textContent = "실패: 대상 저장소를 찾지 못했습니다. 저장소 목록을 먼저 로드하세요.";
    return;
  }

  const requestPayload = {
    ...ownerPayload(),
    client_name: "내부 운영(Design Ops)",
    raw_request: memo || "디자인팀 주관 전 페이지 UI/UX 점검 및 사용자 친화 개선"
  };

  try {
    const reqRes = await fetch(requestsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });
    const reqData = await reqRes.json();
    if (!reqRes.ok) throw new Error(reqData.error || "디자인 요청 생성 실패");

    const assignPayload = {
      ...ownerPayload(),
      request_id: reqData.request.id,
      work_type: "디자인팀 전면 UX 점검",
      mission: "전 페이지 사용자 친화성 개선",
      repository,
      priority: "high",
      refined_request: [
        `[요청 ID] ${reqData.request.id} · 내부 운영(Design Ops)`,
        `[요약] 전 페이지 UI/UX 검토, 깨짐/가독성/흐름 단절 해결`,
        `[주요 작업]`,
        `1. 모든 패널(요청/할당/실행/대화/리포트/감사)의 레이아웃 및 모바일 대응 검증`,
        `2. 한글 문장/라벨/버튼의 이해도 개선`,
        `3. 클라이언트 응대 흐름과 감사 추적 가시성 개선`,
        `[완료 기준]`,
        `1. 디자인팀 점검센터 지표 80점 이상`,
        `2. 깨짐 이슈 0건`,
        `3. 변경점을 리포트 및 감사로그에 남김`
      ].join("\n"),
      apply_changes: true,
      approval_mode: approvalMode
    };

    const jobRes = await fetch(assignUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignPayload)
    });
    const jobData = await jobRes.json();
    if (!jobRes.ok) throw new Error(jobData.error || "디자인 태스크 할당 실패");

    resultEl.textContent = `디자인팀 정식 태스크 생성 완료: ${jobData.job.id}`;
    document.getElementById("designTaskForm").reset();
    await loadAll();
  } catch (error) {
    resultEl.textContent = `실패: ${error.message}`;
  }
}

function setupAuditControls() {
  const kindSelect = document.getElementById("auditKindFilter");
  const searchInput = document.getElementById("auditSearchInput");
  const jobIdInput = document.getElementById("auditJobIdInput");
  const requestIdInput = document.getElementById("auditRequestIdInput");
  const clearButton = document.getElementById("auditSearchClear");
  const quickFilters = Array.from(document.querySelectorAll("#auditQuickFilters button[data-kind]"));
  const fetchLimitSelect = document.getElementById("auditFetchLimit");

  const commitSearch = () => {
    auditFilterState.q = String(searchInput?.value || "").trim().toLowerCase();
    auditFilterState.job_id = String(jobIdInput?.value || "").trim().toLowerCase();
    auditFilterState.request_id = String(requestIdInput?.value || "").trim().toLowerCase();
    paginationState.audit = 1;
    if (tableCache.audit) renderAudit(tableCache.audit);
  };

  if (kindSelect) {
    kindSelect.addEventListener("change", () => {
      auditFilterState.kind = kindSelect.value || "all";
      paginationState.audit = 1;
      if (tableCache.audit) renderAudit(tableCache.audit);
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (auditSearchTimer) clearTimeout(auditSearchTimer);
      auditSearchTimer = setTimeout(commitSearch, 160);
    });
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        if (auditSearchTimer) clearTimeout(auditSearchTimer);
        commitSearch();
      }
      if (event.key === "Escape") {
        searchInput.value = "";
        if (auditSearchTimer) clearTimeout(auditSearchTimer);
        commitSearch();
      }
    });
  }
  if (jobIdInput) {
    jobIdInput.addEventListener("input", () => {
      if (auditSearchTimer) clearTimeout(auditSearchTimer);
      auditSearchTimer = setTimeout(commitSearch, 160);
    });
  }
  if (requestIdInput) {
    requestIdInput.addEventListener("input", () => {
      if (auditSearchTimer) clearTimeout(auditSearchTimer);
      auditSearchTimer = setTimeout(commitSearch, 160);
    });
  }
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (jobIdInput) jobIdInput.value = "";
      if (requestIdInput) requestIdInput.value = "";
      if (auditSearchTimer) clearTimeout(auditSearchTimer);
      commitSearch();
      searchInput?.focus();
    });
  }
  quickFilters.forEach((button) => {
    button.addEventListener("click", () => {
      const nextKind = button.dataset.kind || "all";
      auditFilterState.kind = nextKind;
      if (kindSelect) kindSelect.value = nextKind;
      paginationState.audit = 1;
      if (tableCache.audit) renderAudit(tableCache.audit);
    });
  });
  if (fetchLimitSelect) {
    fetchLimitSelect.addEventListener("change", async () => {
      const n = Number(fetchLimitSelect.value || 200);
      auditFetchState.limit = Number.isNaN(n) ? 200 : Math.min(1000, Math.max(50, n));
      auditFetchState.offset = 0;
      await loadAll();
    });
  }
}

function updateNavHelper(button) {
  const titleEl = document.getElementById("navHelperTitle");
  const descEl = document.getElementById("navHelperDesc");
  if (!titleEl || !descEl || !button) return;
  titleEl.textContent = button.textContent.trim();
  descEl.textContent = button.dataset.desc || "세부 설명이 없습니다.";
}

function setupSnbNavigation() {
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  if (!navItems.length) return;
  const panels = Array.from(document.querySelectorAll("main .panel"));

  const normalizeTarget = (target) => {
    if (!target) return "all";
    if (target === "all") return "all";
    return panels.some((panel) => panel.id === target) ? target : "all";
  };

  const routeTarget = () => {
    const hashRaw = decodeURIComponent((window.location.hash || "").replace(/^#/, "")).trim();
    if (hashRaw) return normalizeTarget(hashRaw);
    const query = new URLSearchParams(window.location.search || "");
    const fromQuery = query.get("section");
    if (fromQuery) return normalizeTarget(fromQuery.trim());
    try {
      const saved = window.localStorage.getItem(NAV_TARGET_STORAGE_KEY) || "";
      if (saved) return normalizeTarget(saved);
    } catch (_) {
      // ignore storage failures
    }
    return "all";
  };

  const setRoute = (target) => {
    const safeTarget = normalizeTarget(target);
    const next = `#${safeTarget}`;
    if (window.location.hash === next) return;
    window.history.replaceState(null, "", next);
    try {
      window.localStorage.setItem(NAV_TARGET_STORAGE_KEY, safeTarget);
    } catch (_) {
      // ignore storage failures
    }
  };

  const applyTarget = (target) => {
    const safeTarget = normalizeTarget(target);
    try {
      window.localStorage.setItem(NAV_TARGET_STORAGE_KEY, safeTarget);
    } catch (_) {
      // ignore storage failures
    }
    const activeBtn =
      navItems.find((btn) => btn.dataset.target === safeTarget) ||
      navItems.find((btn) => btn.dataset.target === "all") ||
      navItems[0];

    navItems.forEach((btn) => btn.classList.toggle("active", btn === activeBtn));
    panels.forEach((panel) => {
      if (safeTarget === "all") {
        panel.classList.remove("hidden-panel");
      } else {
        panel.classList.toggle("hidden-panel", panel.id !== safeTarget);
      }
    });
    updateNavHelper(activeBtn);
  };

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = normalizeTarget(btn.dataset.target);
      setRoute(target);
      applyTarget(target);
    });
  });

  window.addEventListener("hashchange", () => applyTarget(routeTarget()));
  applyTarget(routeTarget());
}

function setupFlowTabs() {
  const tabsRoot = document.getElementById("flowTabs");
  if (!tabsRoot) return;
  tabsRoot.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-target]");
    if (!btn) return;
    const target = btn.dataset.target;
    if (!target) return;
    const navBtn = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (navBtn) {
      navBtn.click();
    }
    const panel = document.getElementById(target);
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupSharedFormControls() {
  const selectors = [
    "#requestSelect",
    "#repoSelect",
    "#jobPriority",
    "#opsFailedJobSelect",
    "#opsPriorityJobSelect",
    "#opsPriorityValue",
    "#approveJobSelect",
    "#approvePhase"
  ];
  selectors.forEach((query) => {
    const el = document.querySelector(query);
    if (el) el.classList.add("control-select");
  });
}

function setupIntakePresets() {
  const chips = Array.from(document.querySelectorAll(".preset-chip"));
  if (!chips.length) return;
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      document.getElementById("workTypeInput").value = chip.dataset.workType || "";
      document.getElementById("missionInput").value = chip.dataset.mission || "";
      document.getElementById("refinedRequestInput").focus();
    });
  });
}

function setupConversationLangToggle() {
  const root = document.getElementById("conversationLangToggle");
  if (!root) return;

  const applyActive = () => {
    const buttons = Array.from(root.querySelectorAll(".lang-btn"));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === conversationLangMode);
    });
  };

  root.addEventListener("click", (event) => {
    const btn = event.target.closest(".lang-btn[data-mode]");
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!["kor", "bilingual", "eng"].includes(mode)) return;
    conversationLangMode = mode;
    applyActive();
    const jobs = tableCache.jobs?.jobs || [];
    renderConversation(pickActiveJob(jobs));
  });

  applyActive();
}

function setupClientDigestCopyButton() {
  const button = document.getElementById("clientDigestCopyBtn");
  const status = document.getElementById("clientDigestStatus");
  if (!button) return;
  button.addEventListener("click", async () => {
    if (!lastClientDigestText) {
      if (status) status.textContent = "복사할 요약이 아직 없습니다.";
      return;
    }
    try {
      await navigator.clipboard.writeText(lastClientDigestText);
      if (status) status.textContent = "요약을 클립보드에 복사했습니다.";
    } catch (error) {
      if (status) status.textContent = `복사 실패: ${error.message}`;
    }
  });
}

function setupTemplateCopyButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".copy-btn");
    if (!button || (!button.dataset.copyTarget && !button.dataset.copyText)) return;
    const targetId = button.dataset.copyTarget;
    const statusId = button.dataset.statusTarget;
    const statusEl = statusId ? document.getElementById(statusId) : null;
    let text = "";
    if (targetId) {
      const target = document.getElementById(targetId);
      text = target?.textContent?.trim() || "";
    } else if (button.dataset.copyText) {
      text = button.dataset.copyText;
    }
    if (!text) {
      if (statusEl) statusEl.textContent = "복사할 내용이 아직 없습니다.";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (statusEl) statusEl.textContent = "복사 완료 · Ctrl+V로 붙여넣으세요.";
    } catch (error) {
      if (statusEl) statusEl.textContent = `복사 실패: ${error.message}`;
    }
  });
}

async function loadRepositories() {
  const res = await fetch(`${reposUrl}?t=${Date.now()}`);
  const data = await res.json();
  reposCache = Array.isArray(data.repositories) ? data.repositories : [];
  const select = document.getElementById("repoSelect");
  refillSelectPreservingValue(
    select,
    "저장소 선택",
    reposCache
      .map((r) => `<option value="${esc(r.path)}">${esc(r.name)} · ${esc(shortRepoName(r.path))}</option>`)
      .join("")
  );
  if (select && !select.value && reposCache.length) {
    select.value = reposCache[0].path;
  }
}

async function loadOwnerInfo() {
  const res = await fetch(`${ownerUrl}?t=${Date.now()}`);
  const data = await res.json();
  ownerUiState.data = data;
  if (data.owner_id) {
    document.getElementById("ownerId").value = data.owner_id;
  }
  document.getElementById("ownerTokenRequired").checked = !!data.owner_token_required;
  renderOwnerModeBadge(data);
  syncOwnerIdentityPanel();
}

async function loadSettings() {
  const res = await fetch(`${settingsUrl}?t=${Date.now()}`);
  const data = await res.json();
  if (data.default_approval_mode) {
    document.getElementById("approvalMode").value = data.default_approval_mode;
  }
  if (data.execution_mode) {
    document.getElementById("executionMode").value = data.execution_mode;
  }
  await loadCodexModels(false, typeof data.codex_model === "string" ? data.codex_model : "");
  if (data.polling_interval_sec) {
    document.getElementById("refreshInterval").value = String(data.polling_interval_sec);
  }
  document.getElementById("pollingEnabled").checked = !!data.polling_enabled;
  restartPolling();
}

async function loadCodexModels(refresh = false, selected = "") {
  const result = document.getElementById("modelRefreshResult");
  try {
    const suffix = refresh ? "&refresh=1" : "";
    const res = await fetch(`${codexModelsUrl}?t=${Date.now()}${suffix}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    fillCodexModelSelect(data.models || [], selected);
    if (result) {
      result.textContent = refresh ? `모델 목록 갱신 완료 (${(data.models || []).length}개)` : "";
    }
  } catch (error) {
    fillCodexModelSelect(fallbackCodexModels, selected);
    if (result) {
      result.textContent = `모델 목록 로딩 실패: ${error.message} (기본 목록 사용)`;
    }
  }
}

async function loadAll() {
  try {
    const [stateRes, reqRes, jobsRes, polRes, auditRes, usageRes, opsRes, preflightRes] = await Promise.all([
      fetch(`${stateUrl}?t=${Date.now()}`),
      fetch(`${requestsUrl}?t=${Date.now()}&limit=${requestFetchState.limit}&offset=${requestFetchState.offset}`),
      fetch(`${jobsUrl}?t=${Date.now()}&limit=${jobsFetchState.limit}&offset=${jobsFetchState.offset}`),
      fetch(`${policiesUrl}?t=${Date.now()}`),
      fetch(`${auditUrl}?t=${Date.now()}&limit=${auditFetchState.limit}&offset=${auditFetchState.offset}`),
      fetch(`${usageUrl}?t=${Date.now()}`),
      fetch(`${opsQueueUrl}?t=${Date.now()}`),
      fetch(`${opsPreflightUrl}?t=${Date.now()}`)
    ]);

    const state = await stateRes.json();
    const requests = await reqRes.json();
    const jobs = await jobsRes.json();
    const policies = await polRes.json();
    const audit = await auditRes.json();
    const usage = await usageRes.json();
    const ops = await opsRes.json();
    const preflight = await preflightRes.json();

    renderMission(state);
    setTimestamp(state.updated_at);
    renderSummary(state.summary);
    renderAlerts(state.agents);
    renderAgents(state.agents);
    renderOffice(state.agents);
    renderTeamHealth(state.agents);
    renderDesignBoard(state);
    renderRequests(requests);
    renderJobs(jobs);
    renderPolicy(policies);
    renderAudit(audit);
    renderExecutionAudit(requests, jobs, audit);
    renderWeeklyKpiCards(requests, jobs);
    renderDesignReview(state, requests, jobs, audit);
    renderLocalTrustBoard(jobs, requests, audit);
    renderUsage(usage);
    renderOpsQueueBoard(ops);
    renderPreflightSummary(preflight);
  } catch (error) {
    document.getElementById("alerts").innerHTML = `<div class="alert">로딩 실패: ${esc(error.message)}</div>`;
  }
}

async function submitOwnerSettings(event) {
  event.preventDefault();
  const result = document.getElementById("ownerSaveResult");
  const payload = {
    ...ownerPayload(),
    local_trust_mode: true,
    owner_token_required: document.getElementById("ownerTokenRequired").checked,
    execution_mode: document.getElementById("executionMode").value,
    codex_model: document.getElementById("codexModel").value,
    default_approval_mode: document.getElementById("approvalMode").value,
    polling_enabled: document.getElementById("pollingEnabled").checked,
    polling_interval_sec: Number(document.getElementById("refreshInterval").value)
  };
  try {
    const res = await fetch(settingsSaveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "운영 설정 저장 실패");
    result.textContent = "운영 설정이 저장되었습니다.";
    await loadOwnerInfo();
    await loadSettings();
    await loadAll();
  } catch (error) {
    result.textContent = `실패: ${error.message}`;
  }
}

async function autoAssignJobFromRequest(_request) {
  // Auto-assign is intentionally disabled to keep intake decisions explicit.
  return;
}

function explainApiError(error) {
  const msg = String(error?.message || "").trim();
  if (!msg) return "알 수 없는 오류";
  if (msg.includes("owner mismatch")) {
    return `${msg} · 운영 설정의 owner_id와 현재 입력값을 일치시켜 주세요.`;
  }
  if (msg.includes("owner token required")) {
    return `${msg} · 운영 설정에서 owner token을 입력해 주세요.`;
  }
  if (msg.toLowerCase().includes("failed to fetch")) {
    return "서버 연결 실패: `./scripts/infra_server_ctl.sh ensure` 후 `doctor`로 점검해 주세요.";
  }
  return msg;
}

function validateJobFormPayload(payload) {
  const errors = [];
  if (!payload.request_id) errors.push("요청을 선택하세요.");
  if (!payload.work_type) errors.push("업무 유형을 입력하세요.");
  if (!payload.mission) errors.push("미션을 입력하세요.");
  if (!payload.repository) errors.push("대상 저장소를 선택하세요.");
  if (!payload.refined_request) errors.push("정제된 작업 지시를 입력하세요.");
  if (!["urgent", "high", "normal", "low"].includes(String(payload.priority || "").toLowerCase())) {
    errors.push("우선순위 값이 올바르지 않습니다.");
  }
  return errors;
}

function validateApprovalPayload(payload) {
  const errors = [];
  if (!payload.job_id) errors.push("승인 대상 작업을 선택하세요.");
  if (!["pre", "post"].includes(String(payload.phase || "").toLowerCase())) {
    errors.push("승인 단계(pre/post)를 선택하세요.");
  }
  return errors;
}

async function submitRequest(event) {
  event.preventDefault();
  const result = document.getElementById("requestSubmitResult");
  const payload = {
    ...ownerPayload(),
    client_name: document.getElementById("requestClientName").value.trim(),
    raw_request: document.getElementById("requestRawInput").value.trim()
  };

  try {
    const res = await fetch(requestsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청 접수 실패");

    result.textContent = `요청 접수 완료: ${data.request.id}`;
    document.getElementById("requestForm").reset();
    await loadAll();
    await autoAssignJobFromRequest(data.request);
  } catch (error) {
    result.textContent = `실패: ${explainApiError(error)}`;
  }
}

async function submitJob(event) {
  event.preventDefault();
  const result = document.getElementById("jobSubmitResult");
  const repository = await resolveRepositorySelection();
  if (!repository) {
    result.textContent = "실패: 대상 저장소를 찾지 못했습니다. 저장소 목록을 먼저 로드하세요.";
    return;
  }
  const payload = {
    ...ownerPayload(),
    request_id: document.getElementById("requestSelect").value,
    work_type: document.getElementById("workTypeInput").value.trim(),
    mission: document.getElementById("missionInput").value.trim(),
    repository,
    priority: document.getElementById("jobPriority").value,
    refined_request: document.getElementById("refinedRequestInput").value.trim(),
    apply_changes: document.getElementById("applyChanges").checked,
    approval_mode: document.getElementById("approvalMode").value
  };
  const errors = validateJobFormPayload(payload);
  if (errors.length) {
    result.textContent = `실패: ${errors.join(" ")}`;
    return;
  }

  try {
    const res = await fetch(assignUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "작업 할당 실패");

    result.textContent = `작업 할당 완료: ${data.job.id}`;
    document.getElementById("jobForm").reset();
    await loadRepositories();
    await loadAll();
  } catch (error) {
    result.textContent = `실패: ${explainApiError(error)}`;
  }
}

async function approveJob(event) {
  event.preventDefault();
  const result = document.getElementById("approveResult");
  const payload = {
    ...ownerPayload(),
    job_id: document.getElementById("approveJobSelect").value,
    phase: document.getElementById("approvePhase").value
  };
  const errors = validateApprovalPayload(payload);
  if (errors.length) {
    result.textContent = `실패: ${errors.join(" ")}`;
    return;
  }

  try {
    const res = await fetch(approveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "승인 처리 실패");

    result.textContent = `${payload.job_id} 작업의 ${payload.phase} 승인 완료`;
    document.getElementById("approveForm").reset();
    await loadAll();
  } catch (error) {
    result.textContent = `실패: ${explainApiError(error)}`;
  }
}

async function runOpsQueueAction(action, extra = {}) {
  const result = document.getElementById("opsQueueResult");
  const payload = { ...ownerPayload(), action, ...extra };
  try {
    const res = await fetch(opsQueueManageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "운영 액션 실패");
    if (data.queue) {
      renderOpsQueueBoard({ queue: data.queue });
    }
    const actionLabel = {
      recover_stalled: "정체 자동 복구",
      requeue_failed: "실패 재큐잉",
      reprioritize: "우선순위 변경"
    }[action] || action;
    result.textContent = `${actionLabel} 실행 완료`;
    await loadAll();
  } catch (error) {
    result.textContent = `실패: ${explainApiError(error)}`;
  }
}

function setupOpsQueueActions() {
  const requeueBtn = document.getElementById("opsRequeueBtn");
  const reprioritizeBtn = document.getElementById("opsReprioritizeBtn");
  const recoverBtn = document.getElementById("opsRecoverBtn");
  if (requeueBtn) {
    requeueBtn.addEventListener("click", async () => {
      const selected = document.getElementById("opsFailedJobSelect")?.value;
      if (!selected) {
        document.getElementById("opsQueueResult").textContent = "실패 작업을 선택하세요.";
        return;
      }
      await runOpsQueueAction("requeue_failed", { job_ids: [selected] });
    });
  }
  if (reprioritizeBtn) {
    reprioritizeBtn.addEventListener("click", async () => {
      const selected = document.getElementById("opsPriorityJobSelect")?.value;
      const priority = document.getElementById("opsPriorityValue")?.value || "normal";
      if (!selected) {
        document.getElementById("opsQueueResult").textContent = "우선순위를 변경할 작업을 선택하세요.";
        return;
      }
      await runOpsQueueAction("reprioritize", { job_ids: [selected], priority });
    });
  }
  if (recoverBtn) {
    recoverBtn.addEventListener("click", async () => {
      await runOpsQueueAction("recover_stalled");
    });
  }
}

function restartPolling() {
  const sec = Number(document.getElementById("refreshInterval").value);
  const enabled = document.getElementById("pollingEnabled").checked;
  if (timer) clearInterval(timer);
  if (enabled) {
    timer = setInterval(loadAll, sec * 1000);
  }
}

document.getElementById("ownerForm").addEventListener("submit", submitOwnerSettings);
document.getElementById("requestForm").addEventListener("submit", submitRequest);
document.getElementById("jobForm").addEventListener("submit", submitJob);
document.getElementById("approveForm").addEventListener("submit", approveJob);
document.getElementById("refreshInterval").addEventListener("change", restartPolling);
document.getElementById("pollingEnabled").addEventListener("change", restartPolling);
document.getElementById("manualRefreshBtn").addEventListener("click", loadAll);
document.getElementById("refreshModelsBtn").addEventListener("click", () => loadCodexModels(true, document.getElementById("codexModel").value));
document.getElementById("designTaskForm").addEventListener("submit", submitDesignTask);

const ownerInput = document.getElementById("ownerId");
if (ownerInput) {
  ownerInput.addEventListener("input", refreshStalledDiagnostics);
}

setupAutoRefineControls();
setupSharedFormControls();
setupSnbNavigation();
setupFlowTabs();
setupPaginationDelegation();
setupIntakePresets();
setupAuditControls();
setupConversationLangToggle();
setupClientDigestCopyButton();
setupTemplateCopyButtons();
setupOpsQueueActions();
setupThemeMode();
setupOwnerIdentityToggle();
loadOwnerInfo()
  .then(loadSettings)
  .then(loadRepositories)
  .then(loadAll)
  .catch((error) => {
    const alerts = document.getElementById("alerts");
    if (alerts) {
      alerts.innerHTML = `<div class="alert">초기 로딩 실패: ${esc(error.message)} · 서버 상태를 확인하세요.</div>`;
    }
  });
