# oh-my-agent-company

[한국어](README.ko.md) | [영어](README.en.md) | [중국어 간체](README.zh-CN.md)

클라이언트 납품을 위한 로컬 멀티 에이전트 오케스트레이션 템플릿입니다.

이 프로젝트는 클라이언트 요청을 접수하고, 작업을 정제하며, 구조화된 파이프라인을 실행하고,
승인 게이트와 감사로그를 포함한 납품 결과를 제공합니다.

## 프로젝트 히어로
![oh-my-agent-company project hero](assets/readme-hero.svg)

## 브랜드 자산
- README 히어로 SVG: `assets/readme-hero.svg`
- GitHub 소셜 프리뷰 PNG: `assets/github-social-preview.png`
- GitHub 소셜 프리뷰 설정 경로: `Settings -> General -> Social preview`
- 프리뷰 자산 재생성: `python3 ./scripts/generate_social_preview.py`

## 이 저장소가 글로벌 협업에 적합한 이유
- 한국어, 영어, 중국어 간체용 README를 분리 제공
- 오픈 협업을 위한 MIT 라이선스 채택
- `request -> assign -> execute -> QA -> report -> response` 전 구간 감사 가능
- `apply_changes=true` 작업은 `codex/*` 작업 브랜치를 만들고 GitHub 원격이면 report 전 commit/push/PR 증적까지 남김
- 헬스 체크와 재시작 제어를 포함한 안전한 로컬 운영

## 저장소 정보
- 저장소: `https://github.com/junghyun2003/oh-my-agent-company`
- 라이선스: `MIT` (`LICENSE`)
- 메인 서버: `scripts/orchestrator_server.py`
- 대시보드: `dashboard/index.html`

## 추천 시작 경로 (3단계)
1. 환경 확인
```bash
bash ./scripts/setup_dev_env.sh --check-only
```

2. 서버 기동
```bash
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh status
```

3. 대시보드 열기
- `http://localhost:18765/dashboard/`

- 가장 빠른 첫 진입은 위 3단계면 충분합니다.
- 자세한 순서는 `docs/ONBOARDING_10MIN.md`를 참고하세요.
- `npm run bootstrap:local`, `bash ./scripts/bootstrap_local.sh --with-smoke`, Playwright, GitHub PR 자동화는 고급 설치/검증 경로입니다.
- 주의: `smoke_*`, `repo_delivery_smoke.py`, `ci_local_check.sh`, `npm run check:smoke` 같은 smoke 계열 명령은 샘플 request/job/audit 데이터를 생성할 수 있습니다.

## 설치 가이드
### 0. 환경 사전 점검
```bash
bash ./scripts/setup_dev_env.sh --check-only
bash ./scripts/ci_local_check.sh --quick
```
- `setup_dev_env.sh --check-only`는 `core required`와 `advanced optional`을 나눠 보여줍니다.
- `ci_local_check.sh --quick`는 비파괴 점검입니다. compile, 문서/정책 체크, 서버 ensure, API contract, preflight만 확인합니다.
- Node, npm, npx, Playwright wrapper, `gh`는 고급 자동화용이며 처음 대시보드 진입에는 없어도 됩니다.
- Codex 런타임은 글로벌 `~/.codex/config.toml`과 무관하게 `model_reasoning_effort="high"`를 명시 오버라이드합니다.

### A. Python만으로 빠르게 실행
```bash
python3 --version
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh status
```

### B. npm 기반 로컬 설치 (고급)
Node.js와 npm이 이미 설치되어 있다면:
```bash
npm install
npm run install:local
npm run bootstrap:local
```

npm이 없다면:
```bash
node --version
npm --version
```
Node.js LTS와 npm을 먼저 설치한 뒤 `npm install`을 실행하세요.

## 빠른 시작
1. 저장소를 복제하고 작업 디렉토리로 이동합니다.
```bash
git clone https://github.com/junghyun2003/oh-my-agent-company.git
cd oh-my-agent-company
```

2. 권장 안전 모드로 서버를 시작합니다.
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh status
```

3. 대시보드를 엽니다.
- 기준 URL: `http://localhost:18765/dashboard/`
- 리다이렉트 별칭: `http://localhost:18765/`, `http://localhost:18765/dashboard`, `http://localhost:18765/dashboard/index.html`
- 경량 모드: `http://localhost:18765/dashboard/?light=1`
- `#section-status` 같은 hash 경로와 마지막 활성 섹션은 새로고침 후에도 유지됩니다.

4. 헬스를 확인합니다.
```bash
./scripts/infra_server_ctl.sh health
```

5. 개발 중 안전하게 재시작합니다.
```bash
./scripts/infra_server_ctl.sh restart
```

## 10분 온보딩
1. 설치 경로를 선택합니다.
```bash
# 권장 경로
./scripts/infra_server_ctl.sh ensure
bash ./scripts/bootstrap_local.sh

# npm 경로 (고급)
npm install
npm run install:local
npm run bootstrap:local

# 샘플 request/job/audit까지 만드는 smoke 경로 (고급)
bash ./scripts/bootstrap_local.sh --with-smoke

# Node.js 필수 강제, npm이 없으면 실패
REQUIRE_NODE=1 bash ./scripts/bootstrap_local.sh
```

2. 접속을 확인합니다.
- `http://localhost:18765/dashboard/`

3. 문제가 있으면 즉시 점검합니다.
```bash
./scripts/infra_server_ctl.sh doctor
./scripts/infra_server_ctl.sh incident
./scripts/infra_server_ctl.sh logs 120
```

4. 빠른 자동 점검을 실행합니다.
```bash
bash ./scripts/ci_local_check.sh --quick
```
- `--quick`은 샘플 request/job/audit를 만들지 않는 비파괴 점검입니다.

## 업데이트 전략
- P0: `watch-start`, `ensure`, `doctor` 중심으로 서비스 가용성 유지
- P1: `system`, `light`, `dark` 테마 전반의 UX 품질 보정
- P2: 작업 지시 카드와 상태판을 통한 운영 투명성 강화
- 변경 순서: `정책 -> 코드 -> 검증`

## 빠른 검토 맵
- 메인 개요: `README.ko.md`
- 팀 역할 매트릭스: `docs/TEAM_ROLE_MATRIX.md`
- 팀별 책임 문서: `teams/AGENTS.md`, `teams/*/AGENTS.md`
- 오케스트레이션 블루프린트: `AGENT_ORCHESTRATION.md`
- 런타임 엔트리포인트: `scripts/orchestrator_server.py`
- 검증 도구: `python3 ./scripts/docs_sync_check.py`, `python3 ./scripts/team_policy_check.py`, `python3 ./scripts/language_policy_check.py`

## 클라이언트 운영 흐름
1. 요청 접수: 원본 클라이언트 요청을 등록합니다.
2. 작업 할당: 요청과 저장소를 선택하고 미션을 정의합니다.
3. 파이프라인 실행: `PM -> CTO -> Dev(parallel) -> Design Review -> QA -> Report`
4. 승인 처리: `manual_pre`, `manual_post`, `manual_both` 게이트를 처리합니다.
5. 납품 응답: 구조화된 클라이언트 응답 템플릿을 전달합니다.
6. 감사 검토: append-only 감사로그의 증적을 확인합니다.

## 투명한 납품 모델
- 모든 클라이언트 요청은 하나의 상태판에서 확인할 수 있습니다.
- 단계: `Intake -> PM -> CTO -> Dev -> Design Review -> QA -> Report -> Done`
- 표시 필드: `담당 팀`, `차단 이슈`, `다음 업데이트 시각`, `최근 변경`
- 팀 작업 지시는 `목표`, `범위`, `수용기준`, `의존성`, `리스크`, `ETA`를 포함한 표준 카드로 기록합니다.
- CEO, CTO, 팀장 의사결정은 정책 문서와 감사로그를 통해 추적됩니다.
- 대시보드는 최근 7일 기준 요청 수, 성공률, 리드타임, 실패 수 KPI를 표시합니다.

## 핵심 개념
- 기본값은 Local Trust Mode이며 로컬 운영에 로그인 필요 없음
- 운영자와 토큰 입력은 축약 표시되며 필요 시 고급 입력 패널로 확장 가능
- `allowed_actions`, `writable_paths` 기반 저장소 정책 강제
- 승인 모드: `auto`, `manual_pre`, `manual_post`, `manual_both`
- 작업 완료 후 `post_job_audit`를 남기는 감사 우선 납품 방식
- 실제 변경 작업은 Dev 착수 시 `codex/*` 브랜치를 만들고 report 단계 전에 브랜치/PR 결과를 기록
- 팀장 체계와 Tech Leader를 통한 거버넌스 운영
- 테마 모드: `system`, `light`, `dark`
- 팀 가동과 대기열을 보여주는 타이쿤형 픽셀 대시보드

## 런타임 명령
안전한 인프라 제어 스크립트:
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
./scripts/infra_server_ctl.sh incident-summary
./scripts/infra_server_ctl.sh logs 120
bash ./scripts/incident_notify.sh --dry-run
```
- 웹훅 재시도: `INCIDENT_NOTIFY_RETRY_MAX=3 INCIDENT_NOTIFY_BACKOFF_SEC=1 bash ./scripts/incident_notify.sh --webhook <url>`

macOS `launchd` 자동 시작:
```bash
bash ./scripts/install_launchd_agent.sh
bash ./scripts/install_launchd_agent.sh --dry-run
bash ./scripts/uninstall_launchd_agent.sh
```

Linux `systemd` 자동 시작 예시:
```bash
sudo tee /etc/systemd/system/oh-my-agent-company.service >/dev/null <<'UNIT'
[Unit]
Description=oh-my-agent-company orchestrator
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/oh-my-agent-company
ExecStart=/usr/bin/python3 /path/to/oh-my-agent-company/scripts/orchestrator_server.py
Restart=always
Environment=ORCHESTRATOR_PORT=18765

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now oh-my-agent-company.service
```

Windows 작업 스케줄러 예시:
1. Trigger: At log on
2. Action: Start a program
3. Program/script: `python`
4. Arguments: `scripts\\orchestrator_server.py`
5. Start in: `C:\\path\\to\\oh-my-agent-company`

가용성 강화 기본값:
- `ensure`는 기본 `3`회까지 자동 복구를 재시도합니다. 필요하면 `ENSURE_MAX_ATTEMPTS`로 조정합니다.
- 안정성 프로브를 통과해야 헬시 상태로 판정합니다. 필요하면 `STABILITY_PROBES`로 조정합니다.
- `start`, `ensure` 시 watchdog 자동 시작이 기본값이며 `INFRA_AUTO_WATCHDOG=0`으로 끌 수 있습니다.
- `incident` 명령은 `OK`, `NOT_RUNNING`, `PORT_CONFLICT`, `HEALTH_FAIL`, `PID_STALE` 진단값을 출력합니다.
- 라이프사이클 이벤트는 `state/orchestrator_lifecycle.log`에 기록됩니다.

npm 지원 명령:
```bash
npm run install:local
npm run bootstrap:local
npm run server:start
npm run server:status
npm run server:ensure
npm run server:watch
npm run server:health
npm run check:api
npm run check:smoke
npm run check:team-policy
npm run check:codex
npm run check:playwright:ops
npm run check:playwright:visual
npm run check:theme
npm run check:local
npm run check:local:quick
npm run ops:queue:summary
npm run ops:queue:dry-run
npm run ops:queue:apply
npm run todo:list
npm run todo:start -- 1
npm run todo:complete -- 1 --verify --commit --push
```

단계별 TODO 실행의 기준 문서:
- `TODO_TRACKER.json`
- `TODO_EXECUTION_PLAN.md`
- `todo_workflow.py complete --commit`는 step 상태 갱신과 코드 변경을 같은 커밋에 원자적으로 묶습니다.

큐 관리:
```bash
python3 ./scripts/ops_queue_manager.py summary
python3 ./scripts/ops_queue_manager.py apply --dry-run
python3 ./scripts/ops_queue_manager.py apply --dispatch-recovery-min 5
python3 ./scripts/ops_queue_manager.py apply --requeue-failed
```

DB 백업 및 복구:
```bash
bash ./scripts/db_maintenance.sh backup
bash ./scripts/db_maintenance.sh list
bash ./scripts/db_maintenance.sh restore ./state/backups/agent_company-YYYYMMDDTHHMMSSZ.db
bash ./scripts/db_maintenance.sh prune 15
bash ./scripts/db_restore_drill.sh --dry-run
```
- `schema_version`은 시작 시 마이그레이션 기준선을 위해 `state_meta`에 저장됩니다.
- 운영 정책: 하루 최소 1회 백업, 릴리즈 전 추가 1회 백업, 기본 보관 15개, 월 1회 복구 드릴 수행

큐 관리 API:
```bash
curl -s http://localhost:18765/api/ops/queue | jq
curl -s http://localhost:18765/api/ops/runtime | jq
curl -s http://localhost:18765/api/ops/preflight | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"recover_stalled"}' | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"requeue_failed","job_ids":["job-123"]}' | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"reprioritize","job_ids":["job-123"],"priority":"urgent"}' | jq
```
- 운영 설정 화면의 `Codex Preflight` 카드에서도 같은 정보를 확인할 수 있습니다.
- `GET /api/ops/preflight`는 `node_path`, `npm_path`, `npx_path`, `playwright_wrapper_path`, `playwright_ready`, `gh_bin_path`, `codex_reasoning_effort`, `effective_codex_args`, `issues`, `remediations`를 포함합니다.
- `GET /api/health`는 `worker_health`를 포함합니다.
- `GET /api/requests`, `GET /api/jobs`, `GET /api/audit`는 `limit`, `offset`을 지원합니다.
- 대시보드의 요청/작업 페이지네이션은 서버 측 `offset` 재조회 방식으로 동작합니다.
- 검증 규칙:
  - `action`: `recover_stalled`, `requeue_failed`, `reprioritize`
  - `job_ids`: 필요 시 `job-*` 형식, 최대 `20`개
  - `priority`: `urgent`, `high`, `normal`, `low`
- 각 액션은 `ops_queue_action_summary` 감사 이벤트에 `before_counts`, `after_counts`, `delta_counts`를 남깁니다.
- 감사로그 UI는 `kind`, `job`, `request`, `owner`, `phase` 필터를 지원합니다.

스모크 테스트 자동화:
- 주의: 아래 명령은 샘플 request/job/audit 데이터를 생성하거나 임시 git 저장소를 사용할 수 있습니다.
```bash
bash ./scripts/api_contract_smoke.sh
bash ./scripts/smoke_core_flows.sh
python3 ./scripts/repo_delivery_smoke.py
bash ./scripts/runtime_recovery_smoke.sh
bash ./scripts/codex_runtime_canary.sh
bash ./scripts/playwright_ops_e2e.sh
bash ./scripts/ci_local_check.sh
```
- `api_contract_smoke.sh`: 핵심 `/api/*` 계약 검증
- `smoke_core_flows.sh`: 요청 접수, 작업 할당, pre-approval, `job_done`, `post_job_audit` 검증
- `repo_delivery_smoke.py`: 임시 git 저장소로 `codex/*` 브랜치 생성, commit/push, 풀리퀘스트 증적 생성을 검증
- `runtime_recovery_smoke.sh`: `dispatching` 고아 복구와 `waiting_pre_approval` 재시작 재조정 검증
- `codex_runtime_canary.sh`: `codex exec --ephemeral -s read-only -m gpt-5-codex -c model_reasoning_effort="high"` 경로 검증
- `playwright_ops_e2e.sh`: 실제 브라우저에서 `auto`, `manual_pre` 무변경 플로우 검증
- `ci_local_check.sh`: `API smoke -> flow smoke -> repo delivery smoke -> runtime recovery smoke -> Codex canary -> Playwright ops E2E -> visual/theme regression` 순서 실행

Playwright 시각 회귀:
```bash
bash ./scripts/visual_regression_playwright.sh
bash ./scripts/theme_regression_check.sh
```

엄격 모드:
```bash
STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/visual_regression_playwright.sh
STRICT_THEME_REGRESSION=1 bash ./scripts/theme_regression_check.sh
STRICT_PLAYWRIGHT_E2E=1 bash ./scripts/playwright_ops_e2e.sh
STRICT_VISUAL_BASELINE=1 bash ./scripts/visual_regression_playwright.sh
```

`npx` 선행 조건:
```bash
node --version
npm --version
npm install -g @playwright/cli@latest
playwright-cli --help
```
- 기준 스크린샷은 `output/playwright/baseline/*`에 저장됩니다.
- 최신 실행 결과는 `output/playwright/current/*`에 저장됩니다.

직접 실행 대체 경로:
```bash
python3 scripts/orchestrator_server.py
```

포트 변경 실행:
```bash
ORCHESTRATOR_PORT=19090 python3 scripts/orchestrator_server.py
```

Tech Leader 감사:
```bash
./scripts/tech_leader_audit.sh
python3 ./scripts/docs_sync_check.py
python3 ./scripts/team_policy_check.py
python3 ./scripts/kpi_weekly_report.py --dry-run
python3 ./scripts/kpi_weekly_report.py --days 7 --output ./reports/kpi/weekly-kpi.json
python3 ./scripts/kpi_weekly_report.py --days 7 --save-latest --save-history
bash ./scripts/security_scan.sh --dry-run
python3 ./scripts/language_policy_check.py
```
- 오탐 제외는 `.security_scan_allowlist`에 substring 단위로 추가합니다.

푸시 전 강제 검증:
```bash
bash ./scripts/install_pre_push_hook.sh
bash ./scripts/install_pre_commit_hook.sh
```
- 설치된 hook은 푸시 전에 `python3 ./scripts/docs_sync_check.py`, `python3 ./scripts/team_policy_check.py`, `python3 ./scripts/language_policy_check.py`, `bash ./scripts/smoke_core_flows.sh`를 실행합니다.
- 정책 문서와 런타임 동작이 어긋나면 푸시가 차단됩니다.

내장 정체 작업 복구:
- 오케스트레이터는 polling 간격으로 정체 작업을 점검합니다.
- 부팅 시 `dispatching`, `in_progress`, `waiting_pre_approval`, `waiting_post_approval` 작업을 고아 상태로 간주하고 자동 재조정합니다.
- `dispatching` 상태는 기본 `5`분인 `dispatch_recovery_min` 기준으로 빠르게 재큐잉합니다.
- 변경 적용 전 끊긴 작업은 같은 job ID로 재큐잉하고, 변경 적용 가능성이 있는 단계에서 끊긴 작업은 `failed(orchestrator_restart_recovery)`로 정리해 수동 재할당 대상으로 남깁니다.
- 앱 설정 키: `queue_warn_min`, `dispatch_recovery_min`, `in_progress_timeout_min`, `ops_recovery_poll_sec`, `worker_concurrency`

## 데이터와 산출물
- DB: `state/agent_company.db`
- 요청 테이블: `requests`
- 작업 테이블: `jobs`
- 에이전트 상태 테이블: `agent_status`
- 감사 테이블: `audit_events`
- 납품 산출물: `deliverables/`
- `state/*.log`, `state/*.pid`, `state/backups/*` 같은 런타임 상태 산출물은 휘발성 데이터로 취급하며 git 추적 대상에서 제외합니다.

## 팀 및 거버넌스 문서
- 문서 인덱스: `docs/INDEX.md`
- 10분 온보딩: `docs/ONBOARDING_10MIN.md`
- 회사 정책: `AGENTS.md`
- 팀 역할 매트릭스: `docs/TEAM_ROLE_MATRIX.md`
- 팀 인덱스: `teams/AGENTS.md`
- 팀 문서: `teams/*/AGENTS.md`
- 오케스트레이션 블루프린트: `AGENT_ORCHESTRATION.md`
- 컴포넌트 거버넌스: `COMPONENT_REGISTRY.md`
- 테마 정책: `teams/design-ops/THEME_POLICY.md`
- 언어 정책: `teams/design-ops/LANGUAGE_POLICY.md`
- 커밋/푸시 규약: `COMMIT_PUSH_RULES.md`
- 마케팅 가이드: `MARKETING_PLAYBOOK.md`
- 거버넌스 근거 문서: `GOVERNANCE_SOURCES_2026-02-21.md`

## 오픈소스 협업
- 기여 방법: `CONTRIBUTING.md`
- 보안 제보: `SECURITY.md`
- CI 워크플로: `.github/workflows/ci.yml`
- 포크 정책: `FORK_CUSTOMIZATION_POLICY.md`
- 업스트림 기준선: `UPSTREAM_BASELINE.env`
- 커스터마이징 로그: `CUSTOMIZATION_LOG.md`

## 포크 사용자: 원본과 커스터마이징 구분
1. `UPSTREAM_BASELINE.env`에 기준선을 설정합니다.
2. `CUSTOMIZATION_LOG.md`에 커스텀 변경을 기록합니다.
3. 커밋 푸터를 사용합니다.
   - `Change-Origin: upstream|custom`
   - `Upstream-Ref: <tag-or-sha-or-none>`
4. 릴리즈 전에 diff 리포트를 생성합니다.
```bash
./scripts/fork_diff_report.sh
./scripts/fork_diff_report.sh --save
```
- 저장 경로: `reports/fork/customization-report-<UTC>.md`
- `UPSTREAM_REF`가 비어 있어도 `upstream branch -> origin/main -> origin/master -> latest tag -> root commit` 순서로 fallback 하여 리포트를 만듭니다.

## 문제 해결
- 브라우저에서 접속되지 않을 때:
  - `./scripts/infra_server_ctl.sh status`
  - `./scripts/infra_server_ctl.sh ensure`
  - `./scripts/infra_server_ctl.sh doctor`
  - `./scripts/infra_server_ctl.sh restart`
  - `./scripts/infra_server_ctl.sh logs 120`
- 요청 또는 작업 할당 API가 `403`을 반환할 때:
  - strict owner mode가 켜져 있으면 `owner_id` 불일치를 확인합니다.
  - token mode가 켜져 있으면 `owner_token`을 제공합니다.
- 포트 충돌:
  - 충돌 프로세스를 중지한 뒤 서버를 재시작합니다.
- 정책 오류:
  - DB 안의 `repo_policies`, `app_settings`를 확인합니다.

## 클라이언트 참고
이 저장소는 CEO, CTO, 각 팀장, 투명한 실행 감사 체계 아래 빠르게 진화합니다.
가독성, 온보딩, 운영 신뢰성은 부가 요소가 아니라 제품 요구사항으로 취급합니다.
