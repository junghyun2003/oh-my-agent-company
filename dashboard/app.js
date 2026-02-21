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
const assignUrl = "/api/jobs/from-request";
const approveUrl = "/api/jobs/approve";
const settingsSaveUrl = "/api/settings/save";

let timer = null;
const requestLookup = new Map();
const PIPELINE_STEPS = [
  { id: "pm", label: "PM", desc: "요청 스코프 확정" },
  { id: "cto", label: "CTO", desc: "기술 아키텍처" },
  { id: "pre_approval", label: "변경 전 승인", desc: "Owner 확인" },
  { id: "dev", label: "Dev", desc: "병렬 구현" },
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
const TABLE_PAGINATION = {
  requests: { size: 5, containerId: "requestsPagination" },
  jobs: { size: 5, containerId: "jobsPagination" },
  audit: { size: 8, containerId: "auditPagination" }
};
const paginationState = { requests: 1, jobs: 1, audit: 1 };
const tableCache = { requests: null, jobs: null, audit: null };
const auditFilterState = { kind: "all", q: "" };
let reposCache = [];
let conversationLangMode = "bilingual";
let lastClientDigestText = "";
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
  qa: "QA 팀이 검증 상황을 보고했습니다.",
  report: "Report 단계에서 납품 준비를 안내했습니다.",
  pre_approval: "변경 전 승인 단계 안내입니다.",
  post_approval: "변경 후 승인 결과입니다."
};

function rememberRequests(requests = []) {
  requestLookup.clear();
  requests.forEach((req) => {
    if (req && typeof req.id !== "undefined") {
      requestLookup.set(String(req.id), req);
    }
  });
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
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-pagination]");
    if (!btn) return;
    event.preventDefault();
    const key = btn.dataset.key;
    const page = Number(btn.dataset.page);
    if (!key || Number.isNaN(page) || !TABLE_PAGINATION[key]) return;
    paginationState[key] = page;
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
  return {
    owner_id: document.getElementById("ownerId").value.trim(),
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

function translateToKorean(text) {
  return TRANSLATION_RULES.reduce((acc, rule) => acc.replace(rule.pattern, rule.replacement), text);
}

function renderConversationLine(event) {
  const message = event.message || "-";
  const stage = event.stage || "";
  const english = esc(message);
  const fallback = STAGE_FALLBACK_KO[stage] || "팀에서 남긴 메시지를 확인하세요.";
  const translated = translateToKorean(message);
  let korean = translated;
  if (translated === message) {
    korean = fallback;
  }
  const showKor = conversationLangMode === "kor" || conversationLangMode === "bilingual";
  const showEng = conversationLangMode === "eng" || conversationLangMode === "bilingual";
  const korLine = showKor ? `<p>${esc(korean)}</p>` : "";
  const engLine = showEng ? `<p class="en-line">${english}</p>` : "";
  return `${korLine}${engLine}` || `<p>${esc(message)}</p>`;
}

function weightedAgentScore(agent) {
  const scoreByStatus = { healthy: 95, warning: 70, critical: 35, idle: 85 };
  const statusScore = scoreByStatus[agent.status] ?? 60;
  const latencyScore = Math.max(0, Math.min(100, 100 - agent.latency_ms / 8));
  const errorScore = Math.max(0, Math.min(100, 100 - agent.error_rate * 800));
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
          <div><span class="status-dot ${statusClass(agent.status)}"></span><strong>${esc(agent.name)}</strong></div>
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

  const desks = agents
    .map((agent, index) => {
      const col = (index * 2) % 10;
      const row = Math.floor(index / 5) % 4;
      return `
        <article class="pixel-desk ${statusClass(agent.status)}">
          <header>
            <strong>${esc(agent.name)}</strong>
            <span class="tag">${esc(statusKo(agent.status))}</span>
          </header>
          <div class="pixel-station">
            <div class="pixel-monitor">${esc(agent.team || "Team")}</div>
            <div
              class="pixel-avatar ${statusClass(agent.status)}"
              style="--sprite-x:${col}; --sprite-y:${row};"
              role="img"
              aria-label="${esc(agent.name)} pixel avatar"
            ></div>
          </div>
          <p class="muted">${esc(agent.current_task || "대기중")}</p>
        </article>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="pixel-office-scene">
      <div class="pixel-office-topline">
        <div class="pixel-building" aria-hidden="true"></div>
        <div class="pixel-banner">
          <strong>oh-my-agnet-company 픽셀 오피스</strong>
          <small>클라이언트가 실시간으로 팀 좌석/업무를 확인하는 뷰</small>
        </div>
      </div>
      <div class="pixel-desks">${desks}</div>
    </div>
  `;
}

function renderTeamHealth(agents) {
  const byTeam = agents.reduce((acc, agent) => {
    if (!acc[agent.team]) acc[agent.team] = [];
    acc[agent.team].push(agent);
    return acc;
  }, {});

  const root = document.getElementById("teamHealth");
  root.innerHTML = Object.entries(byTeam).map(([team, items]) => {
    const score = Math.round(items.map(weightedAgentScore).reduce((s, v) => s + v, 0) / items.length);
    return `<div class="team"><strong>${esc(team)}</strong><div>${score} / 100 가중치 점수</div><div class="bar"><div class="fill" style="width:${score}%"></div></div></div>`;
  }).join("");
}

function renderDesignBoard(state) {
  const rolesRoot = document.getElementById("designOpenRoles");
  const statsRoot = document.getElementById("designStats");
  const profileRoot = document.getElementById("designProfile");
  if (!rolesRoot || !statsRoot || !profileRoot) return;

  rolesRoot.innerHTML = DESIGN_OPEN_ROLES.map((role) => `<li class="design-role"><strong>${esc(role.title)}</strong><span>${esc(role.focus)}</span><em>채용중</em></li>`).join("");

  const agents = Array.isArray(state.agents) ? state.agents.filter((agent) => /design/i.test(agent.team || "")) : [];
  const unavailable = agents.filter((agent) => agent.status !== "healthy").length;
  const issueCount = Math.max(1, Number(state.summary?.warning || 0) + Number(state.summary?.critical || 0));
  const stats = [
    { label: "현 디자인 인원", value: `${agents.length}명`, helper: unavailable ? `${unavailable}명 이슈 해결중` : "모두 가용" },
    { label: "UI 결함 추적", value: `${issueCount}건`, helper: "경고/위험 지표 기준" },
    { label: "필수 채용", value: `${DESIGN_OPEN_ROLES.length}명`, helper: "역할별 1명" }
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
        <h4>신설 대기</h4>
        <p class="muted">디자인 전담 에이전트가 아직 없습니다. Owner가 승인하면 아래 역할이 즉시 투입됩니다.</p>
        <ul class="profile-list">
          ${DESIGN_OPEN_ROLES.map((role) => `<li>${esc(role.title)} · ${esc(role.focus)}</li>`).join("")}
        </ul>
        <div class="profile-note">승인 후 Dev 단계에서 병렬 투입됩니다.</div>
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
  const d = new Date(isoString);
  document.getElementById("lastUpdated").textContent = `업데이트: ${d.toLocaleString("ko-KR")}`;
}

function renderUsage(usage) {
  const stamp = `Codex 사용량(로컬): API ${usage.api_calls_total}회 | 요청 ${usage.requests_total}건 | 작업 ${usage.jobs_total}건 | 완료 ${usage.jobs_done}건 | 변경 파일 ${usage.files_changed_total}개`;
  document.getElementById("usageStamp").textContent = stamp;
}

function renderRequests(payload) {
  tableCache.requests = payload;
  const requests = [...(payload.requests || [])].reverse();
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
          <tr><th>요청 ID</th><th>클라이언트</th><th>상태</th><th>원본 요청</th><th>연결 작업</th></tr>
        </thead>
        <tbody>
          ${rows.map((r) => `<tr><td><code>${esc(r.id)}</code></td><td>${esc(r.client_name)}</td><td><span class="tag">${esc(statusKo(r.status))}</span></td><td>${esc(r.raw_request)}</td><td>${r.linked_job_id ? `<code>${esc(r.linked_job_id)}</code>` : "-"}</td></tr>`).join("")}
        </tbody>
      </table></div>`;
    renderPaginationControls("requests", pagination);
  }

  const requestSelect = document.getElementById("requestSelect");
  refillSelectPreservingValue(
    requestSelect,
    "요청 선택",
    requests
    .filter((r) => r.status === "received" || r.status === "completed")
    .map((r) => `<option value="${esc(r.id)}">${esc(r.id)} | ${esc(r.client_name)} | ${esc(r.status)}</option>`)
    .join("")
  );

  autoFillRefinedRequest({ requestId: requestSelect.value });
}

function describeJob(job) {
  const meta = [job.work_type, job.mission].map((value) => normalizeWhitespace(value)).filter(Boolean);
  return meta.join(" · ");
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

  const events = Array.isArray(job.timeline)
    ? [...job.timeline].sort((a, b) => eventTimestamp(a.at) - eventTimestamp(b.at))
    : [];

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
            <strong>${esc(event.stage ? statusKo(event.stage) : event.actor || "시스템")}</strong>
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

  const latest = [...jobs].sort((a, b) => jobTimestamp(b) - jobTimestamp(a))[0];
  const files = Array.isArray(latest.changed_files) ? latest.changed_files : [];
  const actions = Array.isArray(latest.executed_actions) ? latest.executed_actions : [];
  const qaNote = latest.qa_result || latest.qa_summary || "QA 결과 수집중";
  const filePreview = files.slice(0, 3).map((file) => `<code>${esc(file)}</code>`).join(", ") || "-";
  evidenceRoot.innerHTML = `
    <h3>최근 리포트 · ${esc(latest.id || "-")}</h3>
    <p class="muted">${esc(latest.report_path || "리포트 경로 미지정")}</p>
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

function renderJobs(payload) {
  tableCache.jobs = payload;
  const originalJobs = payload.jobs || [];
  const jobs = [...originalJobs].reverse();
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
          <tr><th>작업 ID</th><th>상태</th><th>단계</th><th>승인 모드</th><th>실행 액션</th><th>변경 파일 수</th><th>리포트</th></tr>
        </thead>
        <tbody>
          ${rows.map((j) => {
            const approval = j.approval_mode || "auto";
            const actions = esc((j.executed_actions || []).join(", ") || "-");
            const changed = (j.changed_files || []).length;
            const report = j.report_path ? `<code>${esc(j.report_path)}</code>` : "-";
            return `<tr><td><code>${esc(j.id)}</code></td><td><span class="tag">${esc(statusKo(j.status))}</span></td><td>${esc(statusKo(j.stage || "-"))}</td><td>${esc(approval)}</td><td>${actions}</td><td>${changed}</td><td>${report}</td></tr>`;
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
  renderConversation(activeJob);
  renderReportHub(originalJobs);
}

function renderPolicy(data) {
  const root = document.getElementById("policyInfo");
  const lines = (data.repositories || []).map((r) => {
    const actions = (r.allowed_actions || []).join(", ") || "-";
    const writable = (r.writable_paths || []).join(", ") || "-";
    return `<div><code>${esc(r.path)}</code> | 허용 액션: ${esc(actions)} | 수정 허용 경로: ${esc(writable)}</div>`;
  });
  root.innerHTML = `<div>기본 승인 모드: <strong>${esc(data.default_approval_mode || "auto")}</strong></div>${lines.join("")}`;
}

function pickDefaultRepoPath() {
  if (!Array.isArray(reposCache) || !reposCache.length) return "";
  return reposCache[0]?.path || "";
}

function applyAuditFilter(events = []) {
  return events.filter((event) => {
    const kind = String(event.kind || "");
    const owner = String(event.owner_id || "");
    const jobId = String(event.job_id || "");
    const requestId = String(event.request_id || "");
    const text = `${kind} ${owner} ${jobId} ${requestId}`.toLowerCase();
    const kindOk = auditFilterState.kind === "all" || kind === auditFilterState.kind;
    const queryOk = !auditFilterState.q || text.includes(auditFilterState.q);
    return kindOk && queryOk;
  });
}

function renderAudit(payload) {
  tableCache.audit = payload;
  const allEvents = [...(payload.events || [])].reverse();
  const events = applyAuditFilter(allEvents);
  const statsEl = document.getElementById("auditFilterStats");
  if (statsEl) {
    const kindLabel = auditFilterState.kind === "all" ? "전체" : auditFilterState.kind;
    const qLabel = auditFilterState.q ? `, 검색어="${auditFilterState.q}"` : "";
    statsEl.textContent = `필터: ${kindLabel}${qLabel} · ${events.length} / ${allEvents.length}건`;
  }
  const root = document.getElementById("auditTable");
  if (!events.length) {
    root.innerHTML = `<p class="muted">감사 로그 이벤트가 없습니다.</p>`;
    renderPaginationControls("audit", { page: 1, totalPages: 1, totalItems: 0 });
    return;
  }
  const pagination = applyPagination("audit", events);
  const rows = pagination.pageItems;
  root.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>시각</th><th>종류</th><th>운영자</th><th>작업</th><th>요청</th><th>상세</th></tr></thead>
      <tbody>
        ${rows.map((e) => `<tr><td>${esc(e.at)}</td><td>${esc(e.kind || "-")}</td><td>${esc(e.owner_id || "-")}</td><td>${esc(e.job_id || "-")}</td><td>${esc(e.request_id || "-")}</td><td class="audit-detail"><pre><code>${escapeHtml(JSON.stringify(e, null, 2))}</code></pre></td></tr>`).join("")}
      </tbody>
    </table></div>`;
  renderPaginationControls("audit", pagination);
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

function renderDesignReview(statePayload, requestsPayload, jobsPayload, auditPayload) {
  const summaryRoot = document.getElementById("designReviewSummary");
  const tableRoot = document.getElementById("designReviewTable");
  if (!summaryRoot || !tableRoot) return;

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
  const repository = document.getElementById("repoSelect").value || pickDefaultRepoPath();
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
  if (kindSelect) {
    kindSelect.addEventListener("change", () => {
      auditFilterState.kind = kindSelect.value || "all";
      paginationState.audit = 1;
      if (tableCache.audit) renderAudit(tableCache.audit);
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      auditFilterState.q = String(searchInput.value || "").trim().toLowerCase();
      paginationState.audit = 1;
      if (tableCache.audit) renderAudit(tableCache.audit);
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
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      navItems.forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      panels.forEach((panel) => {
        if (target === "all") {
          panel.classList.remove("hidden-panel");
          return;
        }
        panel.classList.toggle("hidden-panel", panel.id !== target);
      });
      updateNavHelper(btn);
    });
  });
  const active = navItems.find((btn) => btn.classList.contains("active"));
  if (active) updateNavHelper(active);
}

function setupFlowTabs() {
  const tabsRoot = document.getElementById("flowTabs");
  if (!tabsRoot) return;
  tabsRoot.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-target]");
    if (!btn) return;
    const navAll = document.querySelector('.nav-item[data-target="all"]');
    if (navAll && !navAll.classList.contains("active")) {
      navAll.click();
    }
    const target = btn.dataset.target;
    if (!target) return;
    const panel = document.getElementById(target);
    if (panel) {
      panel.classList.remove("hidden-panel");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

async function loadRepositories() {
  const res = await fetch(`${reposUrl}?t=${Date.now()}`);
  const data = await res.json();
  const select = document.getElementById("repoSelect");
  refillSelectPreservingValue(
    select,
    "저장소 선택",
    data.repositories.map((r) => `<option value="${esc(r.path)}">${esc(r.name)} - ${esc(r.path)}</option>`).join("")
  );
}

async function loadOwnerInfo() {
  const res = await fetch(`${ownerUrl}?t=${Date.now()}`);
  const data = await res.json();
  if (data.owner_id) {
    document.getElementById("ownerId").value = data.owner_id;
  }
  document.getElementById("ownerTokenRequired").checked = !!data.owner_token_required;
  renderOwnerModeBadge(data);
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
  const suffix = refresh ? "&refresh=1" : "";
  const res = await fetch(`${codexModelsUrl}?t=${Date.now()}${suffix}`);
  const data = await res.json();
  fillCodexModelSelect(data.models || [], selected);
  if (result) {
    result.textContent = refresh ? `모델 목록 갱신 완료 (${(data.models || []).length}개)` : "";
  }
}

async function loadAll() {
  try {
    const [stateRes, reqRes, jobsRes, polRes, auditRes, usageRes] = await Promise.all([
      fetch(`${stateUrl}?t=${Date.now()}`),
      fetch(`${requestsUrl}?t=${Date.now()}`),
      fetch(`${jobsUrl}?t=${Date.now()}`),
      fetch(`${policiesUrl}?t=${Date.now()}`),
      fetch(`${auditUrl}?t=${Date.now()}`),
      fetch(`${usageUrl}?t=${Date.now()}`)
    ]);

    const state = await stateRes.json();
    const requests = await reqRes.json();
    const jobs = await jobsRes.json();
    const policies = await polRes.json();
    const audit = await auditRes.json();
    const usage = await usageRes.json();

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
    renderDesignReview(state, requests, jobs, audit);
    renderUsage(usage);
  } catch (error) {
    document.getElementById("alerts").innerHTML = `<div class="alert">로딩 실패: ${esc(error.message)}</div>`;
  }
}

async function submitOwnerSettings(event) {
  event.preventDefault();
  const result = document.getElementById("ownerSaveResult");
  const payload = {
    ...ownerPayload(),
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
    result.textContent = `실패: ${error.message}`;
  }
}

async function submitJob(event) {
  event.preventDefault();
  const result = document.getElementById("jobSubmitResult");
  const payload = {
    ...ownerPayload(),
    request_id: document.getElementById("requestSelect").value,
    work_type: document.getElementById("workTypeInput").value.trim(),
    mission: document.getElementById("missionInput").value.trim(),
    repository: document.getElementById("repoSelect").value,
    refined_request: document.getElementById("refinedRequestInput").value.trim(),
    apply_changes: document.getElementById("applyChanges").checked,
    approval_mode: document.getElementById("approvalMode").value
  };

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
    result.textContent = `실패: ${error.message}`;
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
    result.textContent = `실패: ${error.message}`;
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

setupAutoRefineControls();
setupSnbNavigation();
setupFlowTabs();
setupPaginationDelegation();
setupIntakePresets();
setupAuditControls();
loadOwnerInfo()
  .then(loadSettings)
  .then(loadRepositories)
  .then(loadAll);
