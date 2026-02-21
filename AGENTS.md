# AGENTS Guide (Local Personal Agent Company)

이 저장소는 개인이 로컬 PC에서 "에이전트 회사"를 운영하기 위한 실행형 오케스트레이션 템플릿이다.

## What This System Does
- 클라이언트 요청 접수
- Owner(운영자)가 요청을 정제해 작업 할당
- 파이프라인 실행: `PM -> CTO -> Dev(병렬) -> QA -> Report`
- 수동 승인 게이트(전/후) 처리
- 작업 완료 후 클라이언트 응대
- 전체 이벤트 감사로그 기록

## Runtime Components
- Orchestrator Server: `scripts/orchestrator_server.py`
- Dashboard UI: `dashboard/index.html`, `dashboard/app.js`, `dashboard/styles.css`
- State Store:
  - `state/agent_company.db (table: requests)`
  - `state/agent_company.db (table: jobs)`
  - `state/agent_company.db (table: agent_status)`
  - `state/agent_company.db (table: owner_config)`
  - `state/agent_company.db (table: repo_policies + app_settings)`
  - `state/agent_company.db (table: usage_stats)`
  - `state/agent_company.db (table: audit_events)`

## Global Operation Rules
- Owner mode가 활성화되면 모든 write API는 `owner_id` 검증을 통과해야 한다.
- 저장소 수정은 `state/agent_company.db`의 `repo_policies`/`app_settings` 정책을 따른다.
- 승인 모드(`auto/manual_pre/manual_post/manual_both`)를 작업마다 적용한다.
- 감사로그는 `state/agent_company.db`의 `audit_events` 테이블에 append-only로 기록한다.

## Team Structure
- `teams/AGENTS.md`: 팀 전체 규약 및 인덱스
- `teams/*/AGENTS.md`: 팀별 책임/입출력/KPI/게이트/감사 항목

## Source Of Truth
- 운영 규약 변경 시 아래 파일을 함께 갱신한다.
1. `AGENTS.md`
2. `README.md`
3. `teams/AGENTS.md`
4. 영향받는 `teams/*/AGENTS.md`
