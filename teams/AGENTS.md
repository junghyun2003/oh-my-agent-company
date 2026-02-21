# Team Agent Assignment

팀별 `AGENTS.md`는 `oh-my-agent-company` 운영의 공식 역할 문서다.

## Team Files
- `teams/executive-ceo/AGENTS.md`
- `teams/executive-cto/AGENTS.md`
- `teams/business-strategy/AGENTS.md`
- `teams/marketing/AGENTS.md`
- `teams/product-planning/AGENTS.md`
- `teams/engineering-backend/AGENTS.md`
- `teams/engineering-frontend/AGENTS.md`
- `teams/engineering-app/AGENTS.md`
- `teams/design-ops/AGENTS.md`
- `teams/security-ops/AGENTS.md`
- `teams/quality-assurance/AGENTS.md`
- `teams/infrastructure/AGENTS.md`
- `teams/technology-lead/AGENTS.md`

## Universal Output Contract
모든 팀의 산출물은 다음 4개 섹션을 포함한다.
- `Context`: 현재 상황/제약
- `Decision`: 이번 단계 결정
- `Action`: 즉시 실행 항목
- `Risk`: 리스크와 완화 전략
- `Client Message`: 대외 전달 시 `변경점/영향/리스크/다음 조치` 형태로 요약
- `MDR`: 지금 즉시 전달 가능한 최소 결과물(파일/화면/리포트/결정사항)

## Universal Control Rules
- Owner identity: `owner_id=owner` 기준 실행
- Pipeline order: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> QA -> Report`
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

## Handoff Gate
- PM -> CTO: 범위/수용기준/비기능요구 전달
- CTO -> Dev: 기술 구조/의존성/리스크 전달
- Dev -> QA: 변경 파일/검증 포인트 전달
- QA -> Report: 승인 결과/known issue 전달
