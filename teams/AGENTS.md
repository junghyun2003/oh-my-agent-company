# Team Agent Assignment

팀별 `AGENTS.md`는 로컬 에이전트 회사 운영의 공식 역할 문서다.

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
- `teams/quality-assurance/AGENTS.md`
- `teams/infrastructure/AGENTS.md`

## Universal Output Contract
모든 팀의 산출물은 다음 4개 섹션을 포함한다.
- `Context`: 현재 상황/제약
- `Decision`: 이번 단계 결정
- `Action`: 즉시 실행 항목
- `Risk`: 리스크와 완화 전략

## Universal Control Rules
- Owner identity: `owner_id=owner` 기준 실행
- Pipeline order: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Infra) -> QA -> Report`
- Approval gates: `auto/manual_pre/manual_post/manual_both`
- Repo policy: 허용 저장소/허용 액션/수정 경로 강제
- Audit: 주요 이벤트는 `state/agent_company.db (table: audit_events)` 기록

## Handoff Gate
- PM -> CTO: 범위/수용기준/비기능요구 전달
- CTO -> Dev: 기술 구조/의존성/리스크 전달
- Dev -> QA: 변경 파일/검증 포인트 전달
- QA -> Report: 승인 결과/known issue 전달
