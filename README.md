# oh-my-agent-company

Local multi-agent orchestration template for client delivery.

This project receives client requests, refines work, runs a structured pipeline,
and delivers auditable outcomes with approval gates.

## Mascot
![oh-my-agent-company mascot](assets/oh-my-agent-mascot.svg)

## Why This Repo Is Global-Ready
- Bilingual operation context (Korean-first, globally understandable structure)
- MIT license for open collaboration
- End-to-end auditable workflow (`request -> assign -> execute -> QA -> report -> response`)
- Safe local operation with health checks and restart controls

## Repository Information
- Repository: `https://github.com/junghyun2003/oh-my-agent-company`
- License: `MIT` (`/Users/junghyen2003/Documents/oh-my-agent-company/LICENSE`)
- Main server: `/Users/junghyen2003/Documents/oh-my-agent-company/scripts/orchestrator_server.py`
- Dashboard: `/Users/junghyen2003/Documents/oh-my-agent-company/dashboard/index.html`

## Installation Guide
### A. Python-only quick run
```bash
python3 --version
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh status
```

### B. npm-supported local setup (simple)
If Node.js/npm is installed:
```bash
npm install
npm run install:local
npm run bootstrap:local
```

If npm is missing:
```bash
node --version
npm --version
```
Install Node.js/npm first, then run `npm install`.

## Quick Start (Sequential)
Follow these steps in order.

1. Clone and enter workspace
```bash
git clone https://github.com/junghyun2003/oh-my-agent-company.git
cd oh-my-agent-company
```

2. Start server (recommended safe mode)
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh status
```

3. Open dashboard (canonical URL)
- `http://localhost:18765/dashboard/`
- `http://localhost:18765/`, `http://localhost:18765/dashboard`, `http://localhost:18765/dashboard/index.html` are redirected to this canonical URL.
- section route persistence: `#section-status` 같은 hash 경로와 마지막 섹션이 새로고침 후에도 유지됩니다.

4. Verify health
```bash
./scripts/infra_server_ctl.sh health
```

5. Restart safely during development
```bash
./scripts/infra_server_ctl.sh restart
```

## 10-Minute Onboarding (Fork/External Users)
1. 설치 경로 선택
```bash
# npm 경로
npm install
npm run install:local
npm run bootstrap:local

# python 경로
./scripts/infra_server_ctl.sh ensure
bash ./scripts/bootstrap_local.sh

# Node 필수 강제 (npm 없으면 실패)
REQUIRE_NODE=1 bash ./scripts/bootstrap_local.sh
```
2. 접속 확인
- `http://localhost:18765/dashboard/`
3. 실패 시 즉시 점검
```bash
./scripts/infra_server_ctl.sh doctor
./scripts/infra_server_ctl.sh incident
./scripts/infra_server_ctl.sh logs 120
```
4. 기능 점검 자동화
```bash
bash ./scripts/smoke_core_flows.sh
```

## Update Strategy
- P0: 서비스 가용성 유지 (`watch-start`, `ensure`, `doctor` 기반 자동 복구)
- P1: UX 품질 보정 (다크/라이트/시스템 모드 톤 일관성, 핵심 화면 가독성)
- P2: 운영 투명성 강화 (작업 지시 카드 표준화, 요청별 한눈에 보기 상태판 유지)
- 변경 원칙: `정책 -> 코드 -> 검증` 순서로 반영하고, 릴리즈마다 개선 근거를 문서화

## Client Operation Flow (Sequential)
1. Request intake: register raw client request
2. Work assignment: select request/repository, define mission and refined instruction
3. Pipeline execution: `PM -> CTO -> Dev(parallel) -> Design Review -> QA -> Report`
4. Approval handling: process `manual_pre/manual_post/manual_both` gates
5. Delivery response: send structured response template
6. Audit review: validate evidence in append-only audit logs

## Transparent Delivery Model (One-Glance)
- 각 클라이언트 요청은 단일 상태판에서 확인:
  - 단계: `Intake -> PM -> CTO -> Dev -> Design Review -> QA -> Report -> Done`
  - 표시 필드: `담당 팀`, `차단 이슈`, `다음 업데이트 시각`, `최근 변경`
- 팀원 지시는 표준 작업 지시 카드(목표/범위/수용기준/의존성/리스크/ETA)로 기록
- CEO/CTO/팀장 합의 결과는 정책 문서 및 감사로그로 추적

## Core Concepts
- Local Trust Mode (default): no login required for local operation
- Repository policy enforcement (`allowed_actions`, `writable_paths`)
- Approval modes: `auto`, `manual_pre`, `manual_post`, `manual_both`
- Audit-first delivery with post-completion audit event
- Team leads (non C-level) and Tech Leader for policy/tech governance
- Three theme modes: `system`, `light`, `dark` with Design Ops theme policy
- Pixel status dashboard in tycoon-style operations floor for client visibility

## Runtime Commands
Safe infra control script:
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh stop
./scripts/infra_server_ctl.sh restart
./scripts/infra_server_ctl.sh status
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh doctor
./scripts/infra_server_ctl.sh watch-start
./scripts/infra_server_ctl.sh watch-status
./scripts/infra_server_ctl.sh health
./scripts/infra_server_ctl.sh incident
./scripts/infra_server_ctl.sh logs 120
```

macOS launchd auto-start (optional):
```bash
bash ./scripts/install_launchd_agent.sh
bash ./scripts/install_launchd_agent.sh --dry-run
bash ./scripts/uninstall_launchd_agent.sh
```

Availability hardening defaults:
- `ensure` retries auto-recovery up to `3` attempts (`ENSURE_MAX_ATTEMPTS` override 가능)
- health stability probes run before declaring healthy (`STABILITY_PROBES` override 가능)
- watchdog auto-start is enabled by default on `start/ensure` (`INFRA_AUTO_WATCHDOG=0` to disable)
- `incident` command prints standard diagnosis (`OK|NOT_RUNNING|PORT_CONFLICT|HEALTH_FAIL|PID_STALE`)
- lifecycle events are tracked at `state/orchestrator_lifecycle.log` (`START_OK`, `FLAP_EXIT`, `ENSURE_RECOVERED` 등)

npm-supported commands:
```bash
npm run install:local
npm run bootstrap:local
npm run server:start
npm run server:status
npm run server:ensure
npm run server:watch
npm run server:health
npm run ops:queue:summary
npm run ops:queue:dry-run
npm run ops:queue:apply
npm run todo:list
npm run todo:start -- 1
npm run todo:complete -- 1 --verify --commit --push
```

Step-by-step TODO execution source of truth:
- `/Users/junghyen2003/Documents/oh-my-agent-company/TODO_TRACKER.json`
- `/Users/junghyen2003/Documents/oh-my-agent-company/TODO_EXECUTION_PLAN.md`
- `todo_workflow.py complete --commit`는 step 상태(`done`)와 해당 코드 변경을 같은 커밋에 원자적으로 포함합니다.

Queue management (direct):
```bash
python3 ./scripts/ops_queue_manager.py summary
python3 ./scripts/ops_queue_manager.py apply --dry-run
python3 ./scripts/ops_queue_manager.py apply --requeue-failed
```

DB backup / restore:
```bash
bash ./scripts/db_maintenance.sh backup
bash ./scripts/db_maintenance.sh list
bash ./scripts/db_maintenance.sh restore ./state/backups/agent_company-YYYYMMDDTHHMMSSZ.db
bash ./scripts/db_maintenance.sh prune 15
```
- `schema_version` is tracked in `state_meta` for startup migration baselines.
- 운영 정책:
  - 최소 일 1회 + 릴리즈 직전 1회 백업
  - 기본 보관 개수 15개
  - 월 1회 복구 드릴(restore + health + 핵심 API 확인)

Queue management API:
```bash
# snapshot
curl -s http://localhost:18765/api/ops/queue | jq

# runtime (uptime/boot count)
curl -s http://localhost:18765/api/ops/runtime | jq

# recover stalled jobs
curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"recover_stalled"}' | jq

# requeue failed jobs
curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"requeue_failed","job_ids":["job-123"]}' | jq

# reprioritize queued/running jobs
curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"reprioritize","job_ids":["job-123"],"priority":"urgent"}' | jq
```
- `GET /api/health`는 `worker_health` 필드를 포함해 HTTP 가용성과 워커 정체 여부를 분리해 제공합니다.
- `GET /api/requests`, `GET /api/jobs`는 `limit`/`offset`을 지원합니다. (예: `/api/jobs?limit=300&offset=0`)
- validation rules:
  - `action`: `recover_stalled|requeue_failed|reprioritize`
  - `job_ids`: `job-*` 형식, 최대 20개 (requeue/reprioritize 시 필수)
  - `priority`: `urgent|high|normal|low` (reprioritize 시 필수)
  - action 실행 시 `ops_queue_action_summary` 감사 이벤트에 `before_counts/after_counts/delta_counts`가 기록됩니다.
- `GET /api/audit`는 `limit`/`offset` 파라미터를 지원합니다. (예: `/api/audit?limit=500&offset=0`)

Smoke test automation:
```bash
bash ./scripts/smoke_core_flows.sh
```
- Covers: request intake, job assignment, pre-approval gate, audit evidence, ops queue API, dashboard core section render tokens.
- Playwright visual regression (optional in smoke):
```bash
ENABLE_PLAYWRIGHT_VISUAL=1 bash ./scripts/smoke_core_flows.sh
bash ./scripts/visual_regression_playwright.sh
```
- strict mode (환경 미충족 시 실패 처리):
```bash
STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/visual_regression_playwright.sh
ENABLE_PLAYWRIGHT_VISUAL=1 STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/smoke_core_flows.sh
```
- `npx` prerequisite:
```bash
# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
```
- Baseline screenshots are stored in `output/playwright/baseline/*`, latest runs in `output/playwright/current/*`.

Direct run (fallback):
```bash
python3 scripts/orchestrator_server.py
```

Change port:
```bash
ORCHESTRATOR_PORT=19090 python3 scripts/orchestrator_server.py
```

Tech Leader audit:
```bash
./scripts/tech_leader_audit.sh
python3 ./scripts/docs_sync_check.py
```

Pre-push enforcement (required for local release safety):
```bash
bash ./scripts/install_pre_push_hook.sh
```
- Installed hook runs `python3 ./scripts/docs_sync_check.py` and `bash ./scripts/smoke_core_flows.sh` before every push.
- Push is blocked when policy docs and runtime behavior are out of sync.

Stalled-job recovery (built-in):
- Orchestrator automatically checks stalled jobs on a polling interval.
- App settings keys:
  - `queue_warn_min` (default: `30`)
  - `in_progress_timeout_min` (default: `60`)
  - `ops_recovery_poll_sec` (default: `10`)
  - `worker_concurrency` (default: `2`, max `6`)

## Data and Artifacts
- DB: `/Users/junghyen2003/Documents/oh-my-agent-company/state/agent_company.db`
- Requests table: `requests`
- Jobs table: `jobs`
- Agent status table: `agent_status`
- Audit table: `audit_events`
- Deliverables: `/Users/junghyen2003/Documents/oh-my-agent-company/deliverables/`

## Team and Governance Docs
- Company policy: `/Users/junghyen2003/Documents/oh-my-agent-company/AGENTS.md`
- Team index: `/Users/junghyen2003/Documents/oh-my-agent-company/teams/AGENTS.md`
- Team docs: `/Users/junghyen2003/Documents/oh-my-agent-company/teams/*/AGENTS.md`
- Component governance: `/Users/junghyen2003/Documents/oh-my-agent-company/COMPONENT_REGISTRY.md`
- Theme policy (Design Ops): `/Users/junghyen2003/Documents/oh-my-agent-company/teams/design-ops/THEME_POLICY.md`
- Commit/Push rulebook: `/Users/junghyen2003/Documents/oh-my-agent-company/COMMIT_PUSH_RULES.md`
- Marketing guide: `/Users/junghyen2003/Documents/oh-my-agent-company/MARKETING_PLAYBOOK.md`
- Governance evidence pack: `/Users/junghyen2003/Documents/oh-my-agent-company/GOVERNANCE_SOURCES_2026-02-21.md`

## Open Source Collaboration
- How to contribute: `/Users/junghyen2003/Documents/oh-my-agent-company/CONTRIBUTING.md`
- Security reporting: `/Users/junghyen2003/Documents/oh-my-agent-company/SECURITY.md`
- Fork policy: `/Users/junghyen2003/Documents/oh-my-agent-company/FORK_CUSTOMIZATION_POLICY.md`
- Upstream baseline: `/Users/junghyen2003/Documents/oh-my-agent-company/UPSTREAM_BASELINE.env`
- Custom log: `/Users/junghyen2003/Documents/oh-my-agent-company/CUSTOMIZATION_LOG.md`

## Fork Users: Distinguish Original vs Customized
If you allow public forks, keep original/custom changes separate with the baseline flow:

1. Set your baseline in `UPSTREAM_BASELINE.env`
2. Record custom changes in `CUSTOMIZATION_LOG.md`
3. Use commit footer:
   - `Change-Origin: upstream|custom`
   - `Upstream-Ref: <tag-or-sha-or-none>`
4. Run diff report before release:
```bash
./scripts/fork_diff_report.sh
./scripts/fork_diff_report.sh --save
```
- Saved report path: `reports/fork/customization-report-<UTC>.md`
- `UPSTREAM_REF`가 비어 있어도 baseline fallback 체인(`upstream branch -> origin/main -> origin/master -> latest tag -> root commit`)으로 리포트를 생성합니다.

## Troubleshooting
- Browser cannot connect:
  - `./scripts/infra_server_ctl.sh status`
  - `./scripts/infra_server_ctl.sh ensure`
  - `./scripts/infra_server_ctl.sh doctor`
  - `./scripts/infra_server_ctl.sh restart`
  - `./scripts/infra_server_ctl.sh logs 120`
- Request/assign API returns `403`:
  - if strict owner mode is enabled, check `owner_id` mismatch
  - if token mode is enabled, provide `owner_token`
- Port conflict:
  - stop conflicting process and restart server
- Policy errors:
  - inspect `repo_policies` and `app_settings` in DB

## Notes for Clients
This repository is evolving rapidly with CEO/CTO leadership, team leads,
and transparent execution audits. Global readability and onboarding are treated
as first-class product requirements.
