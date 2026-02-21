# AGENTS Guide (oh-my-agent-company)

이 저장소는 개인이 로컬 PC에서 "oh-my-agent-company"를 운영하기 위한 실행형 오케스트레이션 템플릿이다.

## What This System Does
- 클라이언트 요청 접수
- Owner(운영자)가 요청을 정제해 작업 할당
- 파이프라인 실행: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> QA -> Report`
- 수동 승인 게이트(전/후) 처리
- 작업 완료 후 클라이언트 응대(4블록 템플릿: 변경점/영향/리스크/다음 조치)
- 전체 이벤트 감사로그 기록 + 작업 완료 직후 `post_job_audit` 자동 생성

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
- 작업이 완료(`job_done`)되면 같은 작업 ID에 대해 `post_job_audit` 이벤트를 추가로 기록한다.
- 팀별 의견 수렴 결과는 `TEAM_FEEDBACK_YYYY-MM-DD.md`로 남기고 정책 문서에 반영한다.
- 팀 의견 충돌 시 의사결정 우선순위는 `CEO > CTO > Product/QA > other teams`를 따른다.
- Dev 착수 전 실행 커맨드/경로 정책 검증 결과를 감사로그에 남긴다.
- QA 결과는 `pass/block/waive` 형태로 구조화한다.
- 클라이언트 응답은 `변경점/영향/리스크/다음 조치` 4블록 템플릿을 기본으로 사용한다.
- 클라이언트 요구가 어렵거나 무리해 보여도 업무 거절을 기본값으로 두지 않는다. 대신 범위 분해, 단계적 납품, 리스크 고지를 통해 반드시 실행 가능한 결과물을 제시한다.
- 모든 단계는 "지금 당장 전달 가능한 최소 결과물(MDR: Minimum Deliverable Result)"을 남겨야 한다.
- 제3자 사용성은 월 1회 이상 정기 리뷰를 수행하고, 결과를 문서(`THIRD_PARTY_REVIEW_YYYY-MM-DD.md`)로 남긴다.
- 제3자 사용성 개선 항목은 매 릴리즈에 최소 1개 이상 반영한다.
- 서버/워커는 개별 요청 실패로 전체 중단되지 않도록 운영하며, 실패 원인과 완화 조치를 감사로그에 남긴다.
- 장시간 정체 또는 실패 작업은 CEO/CTO 에스컬레이션 판단 대상으로 관리한다.
- 고위험 변경은 CTO가 대체안(A/B)과 롤백 방향을 제시하고, CEO가 클라이언트 전달 우선순위를 확정한다.
- 디자인/마케팅 팀은 월 1회 이상 공식 경제지표(BLS/BEA/Federal Reserve 등)와 UX 레퍼런스를 검토하고, UX 개선 태스크에 반영한다.
- C-Level(CEO/CTO)을 제외한 각 팀은 팀장(Lead Agent)을 운영하며, 외부 자료 탐색/내부 정책 정제/팀 작업 우선순위 조정 책임을 가진다.
- Tech Leader Agent는 CEO/CTO와 기술 의사결정을 공동 리딩하며, 신기술 트렌드 검토/적용 판단/팀별 기술 정책 문서 업데이트를 총괄한다.
- Design Ops는 공통 컴포넌트 분리/재사용 정책을 유지하고 Frontend와 함께 컴포넌트 레지스트리를 운영한다.

## Team Structure
- `teams/AGENTS.md`: 팀 전체 규약 및 인덱스
- `teams/*/AGENTS.md`: 팀별 책임/입출력/KPI/게이트/감사 항목

## Source Of Truth
- 운영 규약 변경 시 아래 파일을 함께 갱신한다.
1. `AGENTS.md`
2. `README.md`
3. `teams/AGENTS.md`
4. 영향받는 `teams/*/AGENTS.md`
5. `THIRD_PARTY_READINESS.md`
6. 대외 메시지 변경 시 `MARKETING_PLAYBOOK.md`
