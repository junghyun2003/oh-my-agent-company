# Team Agent Assignment

팀별 `AGENTS.md`는 `oh-my-agent-company` 운영의 공식 역할 문서다.

## Team Files
- `teams/executive-ceo/AGENTS.md`
- `teams/executive-cto/AGENTS.md`
- `teams/business-strategy/AGENTS.md`
- `teams/marketing/AGENTS.md`
- `teams/project-manager/AGENTS.md`
- `teams/product-planning/AGENTS.md`
- `teams/engineering-backend/AGENTS.md`
- `teams/engineering-frontend/AGENTS.md`
- `teams/engineering-app/AGENTS.md`
- `teams/design-ops/AGENTS.md`
- `teams/security-ops/AGENTS.md`
- `teams/quality-assurance/AGENTS.md`
- `teams/infrastructure/AGENTS.md`
- `teams/technology-lead/AGENTS.md`

## Team File Standard
- 각 팀 문서는 최소 `Mission`, `Pipeline Responsibility`, `Inputs`, `Outputs`, `Success Metrics`, `Decision Rights`, `Handoff and Gate`, `Audit Fields You Must Leave`, `Local Operation Rules`를 포함한다.
- 팀장 역할을 분리 운영하는 팀 문서는 `Team Lead Role` 섹션을 추가해 외부 레퍼런스 탐색/정책 정제/우선순위 조정 책임을 명시한다.
- KPI와 게이트는 추상 문구 대신 측정 가능한 결과(예: 필수 필드 누락 0건, verdict 기록, smoke 통과, 정책 준수 여부)로 작성한다.
- 빠른 검토용 팀 전체 스냅샷은 `docs/TEAM_ROLE_MATRIX.md`를 기준으로 유지한다.

## Universal Output Contract
모든 팀의 산출물은 다음 4개 섹션을 포함한다.
- `Context`: 현재 상황/제약
- `Decision`: 이번 단계 결정
- `Action`: 즉시 실행 항목
- `Risk`: 리스크와 완화 전략
- `Client Message`: 대외 전달 시 `변경점/영향/리스크/다음 조치` 형태로 요약
- `MDR`: 지금 즉시 전달 가능한 최소 결과물(파일/화면/리포트/결정사항)
- `Team Pride`: 이번 작업에서 팀이 쌓은 재사용 자산/학습/성과 1개 이상
- `Instruction Card`: 팀원에게 전달한 상세 업무 지시(목표/범위/수용기준/의존성/리스크/ETA)
- `Visibility`: 클라이언트 상태판에 노출할 현재 단계/담당/차단요인/다음 업데이트 시각

## Universal Control Rules
- Owner identity: `owner_id=owner` 기준 실행
- Pipeline order: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> Design Review -> QA -> Report`
- Approval gates: `auto/manual_pre/manual_post/manual_both`
- Repo policy: 허용 저장소/허용 액션/수정 경로 강제
- Audit: 주요 이벤트는 `state/agent_company.db (table: audit_events)` 기록
- Feedback loop: 팀 의견 수렴 결과는 `TEAM_FEEDBACK_YYYY-MM-DD.md`로 남기고 정책에 반영
- QA output: 결과 상태를 `pass/block/waive`로 구조화
- Client delivery: 클라이언트 응답은 4블록 템플릿으로 표준화
- Client commitment: 요구가 어렵더라도 거절 대신 범위 분해/단계 납품/대안 제시로 결과물을 반드시 제공
- Third-party review: 월 1회 `THIRD_PARTY_REVIEW_YYYY-MM-DD.md` 작성, 개선 Top 3를 다음 릴리즈 백로그로 등록
- Executive escalation: 장시간 정체/실패 작업은 CEO/CTO 판단 대상으로 승격
- Market intelligence: Design/Marketing은 월 1회 이상 공식 시장지표(BLS/BEA/Federal Reserve) 업데이트를 공유하고 UX/메시지에 반영
- Team leadership: C-Level 제외 각 팀은 `팀장(Lead Agent)`을 두고, 외부 레퍼런스 탐색/내부 정책 정제/업무 우선순위 정리를 담당
- Tech leadership: `Tech Leader Agent`는 전사 기술 리딩 역할로 CEO/CTO와 긴밀히 협업하며 신기술 적용 여부와 팀 문서 업데이트를 주도
- Design system: Design Ops는 공통 컴포넌트 분리/재사용 정책을 유지하고 Frontend와 함께 컴포넌트 레지스트리를 관리
- Design authority: Design Ops는 UI/UX 변경의 정책 준수 최종 판단권(`pass/block/waive`)을 가진다.
- Decision priority: 팀 의견 충돌 시 의사결정 우선순위는 `CEO > CTO > Product/QA > other teams`
- Theme policy: 테마 모드(`system/light/dark`)는 `teams/design-ops/THEME_POLICY.md`를 기준으로 유지
- Commit/Push policy: 커밋/푸시 절차는 `COMMIT_PUSH_RULES.md`를 기준으로 운영
- Intake priority contract: 요청 접수 시 `긴급도/중요도/의존성` 필드를 필수로 수집
- Release gate: 릴리즈 전 `정책(문서)-코드(구현)-검증(스크립트)` 3축 체크를 수행
- Runtime gate: `Codex canary`, `Playwright 브라우저 E2E`, `post_job_audit`, `Codex Preflight` 치명 이슈 여부를 함께 확인
- Leadership council: CEO/CTO/Tech Leader/팀장은 주 1회 의사결정 회의를 수행하고 결과를 추적 가능하게 기록
- Client transparency: 요청 단위 단일 상태판(칸반+타임라인) 업데이트를 필수 운영
- Queue order: 큐 소진 순서는 `urgent -> high -> normal -> low`, 동순위는 FIFO(`created_at`)
- Stalled threshold: `queued 30분`, `in_progress 60분` 초과 시 정체 작업으로 분류
- Dispatching recovery: `dispatching 5분` 초과 시 같은 job id로 즉시 `queued` 복구
- Stalled recovery: 정체 작업은 `failed(stalled_timeout_recovery)` 종료 + 요청 `received` 재등록 + 감사로그(`job_stalled_recovered`) 기록을 표준화
- Restart reconciliation: 서버 재시작 시 `dispatching/in_progress/waiting_*` 고아 작업을 부팅 직후 재조정
- Reassignment rule: 정체 복구 후 재할당 시 기존 `repository/work_type/mission/priority`를 기본값으로 재사용

## Design Involvement Contract (Required)
- 모든 팀은 디자인 영향이 있는 변경(화면/문구/레이아웃/테마/컴포넌트)을 Design Ops와 사전 공유해야 한다.
- PR/릴리즈/작업 완료 판단 시 Design Ops 결과가 없으면 `완료`로 처리할 수 없다.
- 디자인 관련 작업 지시에는 최소 3개 수용기준을 포함한다:
1. 시각 일관성(토큰/컴포넌트 규약 준수)
2. 가독성(한글 기준 문장/간격/대비)
3. 상호작용 명확성(버튼/입력/오류 메시지)
- Design Ops가 `block`을 선언하면 Frontend/QA/PM은 우선순위를 상향해 즉시 재작업한다.

## Final Workload Reorg (Activated: 2026-02-21)
- Project Manager: 파이프라인 `PM` 단계 오너로서 범위/우선순위/의존성 잠금 및 CTO 핸드오프 전담
- Product Planning: 요청 접수 단계에서 우선순위 필드(`긴급/중요/의존성`) 누락 금지
- Engineering Frontend: 공통 컴포넌트/디자인 토큰 변경은 단일 소스 기준으로만 반영
- Engineering Backend: 요청/작업/승인 상태 전이 규칙을 문서+테스트로 고정
- Engineering App: 모바일 전환 대비 API 응답 계약 안정화 항목을 상시 추적
- Design Ops: `Design Review` 게이트를 Dev 이후 필수 유지, 테마 정책 준수를 릴리즈 조건화
- Quality Assurance: 배포 전 핵심 화면(`승인/감사로그/작업할당`) 스모크 체크 + 브라우저 E2E + `post_job_audit` 확인 필수
- Infrastructure: 서버 운영은 `infra_server_ctl.sh` 표준 강제, 충돌 시 자동 진단 로그 확보 + Node/npm/npx/Playwright prerequisite 가시화
- Security Ops: 민감정보 노출(로그/응답/문서) 주기 점검을 정규 루틴으로 운영
- Marketing: 모든 대외 문구를 `한 줄 가치제안 + 3개 핵심 강점` 템플릿으로 통일
- Business Strategy: 팀별 KPI를 공통 대시보드에서 동일 주기로 추적
- Technology Lead: 릴리즈 게이트에 `정책-코드-검증` 3축 점검을 포함해 재발 방지

## Motivation Protocol (Required)
- 팀장은 주 1회 이상 팀 성과를 `고객가치/품질개선/운영안정` 3분류로 요약 공유한다.
- 실패 작업은 개인 비난 없이 `원인-교정-재발방지` 3단 구조로 기록한다.
- 반복 사용 가능한 산출물(템플릿/스크립트/컴포넌트)을 만든 팀은 문서에 출처를 남겨 조직 자산으로 승격한다.

## Handoff Gate
- Product Planning -> PM: 정제 요구사항/우선순위/의존성 전달
- PM -> CTO: 범위/수용기준/비기능요구 전달
- CTO -> Dev: 기술 구조/의존성/리스크 전달
- Dev -> QA: 변경 파일/검증 포인트 전달
- QA -> Report: 승인 결과/known issue 전달
- Infrastructure -> Executive: 정체 복구가 동일 요청에서 2회 이상 발생하면 CEO/CTO 즉시 에스컬레이션
