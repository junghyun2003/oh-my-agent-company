# AGENTS Guide (oh-my-agent-company)

이 저장소는 개인이 로컬 PC에서 "oh-my-agent-company"를 운영하기 위한 실행형 오케스트레이션 템플릿이다.

## What This System Does
- 클라이언트 요청 접수
- Owner(운영자)가 요청을 정제해 작업 할당
- 파이프라인 실행: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> Design Review -> QA -> Report`
- 수동 승인 게이트(전/후) 처리
- 작업 완료 후 클라이언트 응대(4블록 템플릿: 변경점/영향/리스크/다음 조치)
- 전체 이벤트 감사로그 기록 + 작업 완료 직후 `post_job_audit` 자동 생성
- 실행 상태 대시보드: 타이쿤형 픽셀 업무 환경으로 팀 가동/대기열/핸드오프를 시각화

## Local Company Charter
- 본 회사는 로컬 환경에서 동작하며 기본 운영 모드는 `무로그인(Local Trust Mode)`이다.
- 대상 디렉토리는 제한하지 않는다. (GitHub 저장소, 빈 디렉토리, 외부 디자인 자산 등)
- 클라이언트 만족을 최우선으로 하며, 불만족 시 피드백을 반영해 반복 개선을 계속 수행한다.

## Pride & Motivation Principles
- 모든 에이전트는 본인의 산출물이 회사 신뢰를 만든다는 관점으로 업무를 수행한다.
- 성과는 개인이 아닌 팀 단위 기여로 기록하고, 실패는 책임 추궁보다 재발 방지 중심으로 다룬다.
- 기술/디자인/운영 개선 제안은 직급과 무관하게 제안 가능하며, 근거가 있으면 우선 검토한다.
- 고객 가치에 직접 기여한 개선은 감사로그와 리포트에 명시해 팀의 성취로 축적한다.

## Leadership Deliberation Protocol
- CEO, CTO, Tech Leader, 각 팀장은 주 1회 `운영 의사결정 회의`를 수행한다.
- 회의 출력은 최소 3개를 남긴다: `결정사항`, `근거`, `실행 책임자/기한`.
- 긴급 이슈(서버 불안정/보안/클라이언트 차단)는 24시간 내 임시 회의로 에스컬레이션한다.
- 회의 결과는 `audit_events` 또는 정책 문서(`POLICY_REVIEW.md`)에 추적 가능하게 남겨야 한다.

## Work Instruction Transparency Standard
- 팀원에게 전달되는 작업 지시는 `작업 지시 카드` 형식으로 표준화한다.
- 필수 필드: `목표`, `범위(포함/제외)`, `수용기준`, `의존성`, `리스크`, `담당자`, `ETA`, `다음 보고 시각`.
- 필수 필드 누락 시 작업 시작을 금지한다.
- 클라이언트 요청 단위마다 상태판에서 동일 필드를 조회 가능해야 한다.

## Client One-Glance Visibility Standard
- 모든 요청은 단일 상태판에서 `현재 단계`, `담당 팀`, `차단 이슈`, `다음 업데이트 시각`이 보여야 한다.
- 상태판 컬럼은 최소 `Intake/PM/CTO/Dev/Design Review/QA/Report/Done`을 유지한다.
- 상태판 업데이트 지연(마지막 업데이트 1시간 초과)은 운영 경고 대상으로 분류한다.
- 운영 지표는 DORA 핵심 지표(배포 빈도/리드타임/복구시간/실패율)와 함께 월 단위로 공유한다.

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
- 테마 모드(`system/light/dark`)는 Design Ops 테마 정책(`teams/design-ops/THEME_POLICY.md`)을 따른다.
- 커밋/푸시 운영은 `COMMIT_PUSH_RULES.md`를 기본 규약으로 사용한다.
- 요청 접수 시 우선순위 필드(`긴급도/중요도/의존성`)를 필수 입력으로 관리한다.
- 상태 전이(요청/작업/승인) 규칙은 문서와 테스트로 동기화해 변경 시 동시 갱신한다.
- 핵심 릴리즈 게이트는 `정책(문서) - 코드(구현) - 검증(스크립트/체크)` 3축으로 운영한다.

## Mandatory Enforcement (Non-Negotiable)
- 본 문서의 규칙은 권고가 아니라 강제 정책이며, 예외는 `CEO` 또는 `CTO`의 명시 승인 없이는 허용되지 않는다.
- `Local Trust Mode=ON`에서는 로그인/토큰 검증을 기본 비활성으로 운영한다. (`owner_id` 자동 보정)
- `owner_id` 검증 실패, 정책 경로 위반, 승인 게이트 우회 시 해당 요청/작업은 즉시 `차단`한다.
- `Design Review`, `QA verdict`, `post_job_audit` 누락 시 릴리즈/납품을 금지한다.
- `요청 우선순위(긴급/중요/의존성)` 누락 시 Dev 단계로 전달할 수 없다.
- 상태 전이 규칙 변경 시 문서/테스트 동시 갱신이 없으면 변경을 무효로 간주하고 병합을 금지한다.
- 팀별 필수 산출물(`Context/Decision/Action/Risk/Client Message/MDR`) 누락 시 작업 완료(`job_done`)를 승인하지 않는다.
- 정책 위반 또는 반복 실패는 감사로그에 원인/조치/재발방지 항목을 남기고 CEO/CTO 에스컬레이션 대상으로 자동 승격한다.
- 클라이언트 피드백 루프는 단발성으로 종료하지 않으며, 만족 기준 충족까지 반복 수행 상태를 유지한다.
- 각 작업 종료 시 팀 기여 항목 1개 이상(개선/학습/재사용 자산)을 `report` 또는 `audit`에 남기지 않으면 완료 승인하지 않는다.

## Release Block Conditions
- 아래 항목 중 하나라도 충족하면 배포/납품을 즉시 보류한다.
1. Owner 검증 실패(`403`, owner mismatch, token mismatch) - 단, `Local Trust Mode=OFF`일 때 적용
2. Repo policy 위반(`allowed_actions`, `writable_paths`)
3. 승인 게이트 위반(`manual_pre/manual_post/manual_both`)
4. `Design Review` 또는 `QA verdict` 누락
5. `post_job_audit` 미기록
6. 보안 점검 누락(민감정보 노출 점검 미수행)

## Final Team Responsibility Reorg (Effective: 2026-02-21)
- 발동 기준: `팀장 의견 수렴본`을 CEO 우선 원칙으로 확정 반영
- Project Manager: 파이프라인 `PM` 단계 전담 오너로 분리 운영
- Product Planning: 우선순위 표준 필드(`긴급/중요/의존성`) 강제
- Engineering Frontend + Design Ops: 컴포넌트/디자인 토큰 단일 소스 유지
- Engineering Backend: 상태 전이 규칙 문서+테스트 고정
- Engineering App: 모바일 전환 대비 API 응답 계약 안정화 선행
- Quality Assurance: 핵심 화면(승인/감사로그/작업할당) 스모크 체크 배포 전 필수
- Infrastructure: 운영 스크립트 표준 강제 + 충돌 시 자동 진단 로그 확보
- Security Ops: 민감정보 노출(로그/응답/문서) 주기 점검 고정
- Marketing: `한 줄 가치제안 + 3개 핵심 강점` 템플릿으로 대외 메시지 통일
- Business Strategy: 팀별 KPI를 공통 대시보드/동일 주기로 추적
- Technology Lead: 릴리즈 게이트에 `정책-코드-검증` 3축 점검 포함

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
7. 근거 자료 업데이트 시 `GOVERNANCE_SOURCES_YYYY-MM-DD.md`
