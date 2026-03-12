# Enterprise Agent Group Blueprint

이 문서는 현재 `oh-my-agent-company` 저장소에서 실제로 운영 중인 팀 구조와 파이프라인을 빠르게 이해하기 위한 블루프린트입니다.

## 1) 조직 구조

### Executive Layer
- CEO Agent
  - 미션: 클라이언트 가치와 납품 신뢰를 동시에 만족하는 최종 우선순위를 결정
  - 책임: 범위 축소/확장 판단, 클라이언트 메시지 승인, 고위험 변경 에스컬레이션 결정
  - 핵심 게이트: `Design Review`, `QA verdict`, `post_job_audit` 누락 시 납품 금지

- CTO Agent
  - 미션: 요청을 구현 가능한 기술 실행안으로 변환
  - 책임: 병렬 Dev 경계 설정, A/B 대체안과 롤백 방향 제시, 릴리즈 블로커 기술 판단
  - 핵심 게이트: PM 패키지 미완성 시 Dev handoff 금지

### Planning and Business Layer
- Business Strategy Agent
  - 미션: 요청 가치/ROI/KPI 기준선을 정리해 우선순위 판단 지원
  - 책임: 가치 가설, 범위 축소/확장 제안, KPI 기준선 설정

- Marketing Agent
  - 미션: 결과물이 고객 반응과 외부 포지셔닝으로 이어지도록 메시지 정제
  - 책임: `한 줄 가치제안 + 3개 핵심 강점`, 4블록 응답 템플릿, 한글 우선 메시지 일관성 유지

- Product Planning Agent
  - 미션: `raw_request -> refined_request` 정제와 수용 기준 정의
  - 책임: 우선순위(`긴급/중요/의존성`) 완비, MDR 정의, PM 입력 품질 보장

- Project Manager Agent
  - 미션: 파이프라인 `PM` 단계 전담 오너
  - 책임: 범위/의존성/ETA 잠금, CTO handoff 패키지 완성, 작업 지시 카드 기준 유지

### Delivery Layer
- Backend Engineering Agent
  - 책임: API/DB/상태 전이/런타임 복구 구현
  - 핵심 검증: 상태 전이 규칙 문서+테스트 동시 갱신

- Frontend Engineering Agent
  - 책임: 대시보드 UI/상호작용 구현, 공통 컴포넌트 재사용
  - 핵심 검증: Design Ops 기준과 충돌 없는 UI 반영

- App Engineering Agent
  - 책임: 모바일 영향 평가와 API 응답 계약 안정화
  - 핵심 검증: 앱 영향 메모 또는 후속 작업 티켓 유지

- Design Ops Agent
  - 책임: 디자인 정책 집행, `Design Review` verdict 기록, 테마/토큰/컴포넌트 통제
  - 핵심 검증: UI 변경마다 Design Authority 게이트 반영

- Security Ops Agent
  - 책임: 민감정보/권한/입력 검증 리스크 점검과 완화안 제시
  - 핵심 검증: `low/medium/high` 위험도와 완화 조치 구조화

### Reliability and Governance Layer
- Quality Assurance Agent
  - 책임: `pass/block/waive` verdict, 핵심 화면 스모크, 브라우저 E2E, `post_job_audit` 확인
  - 핵심 검증: 릴리즈 전 QA 증거와 고객 영향 설명 완비

- Infrastructure Agent
  - 책임: 로컬 오케스트레이터 실행, `Codex Preflight`, 재시작/정체 복구, 운영 런북 관리
  - 핵심 검증: `process + port + api` 헬스와 운영 표준 체크 유지

- Technology Lead Agent
  - 미션: 전사 기술 리딩과 문서/코드/검증 정합성 유지
  - 책임: 기술 트렌드 리뷰, 팀 정책 정렬, 릴리즈 게이트 불일치 탐지
  - 핵심 검증: `정책-코드-검증` 3축 불일치 시 CTO/CEO 보류 권고

## 2) 핵심 의사결정 체계 (RACI Lite)

- 우선순위 충돌: CEO(A), CTO/Product/QA(C), 나머지(I)
- 기술 구조/롤백 방향: CTO(A), Tech Lead/Infra/Backend(R), PM/Product(C)
- 요청 정제와 PM 패키지 잠금: Product Planning(A/R), PM(R), CTO(C)
- 디자인/UX 정책 준수: Design Ops(A), Frontend(R), QA/PM(C)
- 보안 위험도와 완화 방향: Security Ops(R), QA/CTO(A/C), CEO(I)
- 릴리즈 승인: QA(A), CTO/Design Ops/Infra(C), CEO(I)

`A=Accountable, R=Responsible, C=Consulted, I=Informed`

## 3) 실행 워크플로우

1. 클라이언트 요청을 Intake로 등록하고 우선순위(`긴급/중요/의존성`)를 수집한다.
2. Business Strategy / Marketing / Product Planning이 가치, 메시지, refined request를 정리한다.
3. Project Manager가 `PM` 단계에서 범위/의존성/ETA를 잠근다.
4. CTO와 Technology Lead가 기술 실행안, 롤백 방향, Dev 경계선을 확정한다.
5. Dev 단계에서 `Backend / Frontend / App / Design / Security / Infra`가 병렬로 움직인다.
6. Design Ops가 `Design Review` verdict(`pass/block/waive`)를 남긴다.
7. QA가 스모크, Codex canary, 브라우저 E2E, `post_job_audit` 증거를 점검한다.
8. CEO/Marketing이 `변경점/영향/리스크/다음 조치` 형식으로 클라이언트 전달 메시지를 확정한다.

파이프라인 표준:
- `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> Design Review -> QA -> Report`

## 4) 커뮤니케이션 규약

- 모든 팀 산출물은 최소 아래 항목을 남긴다.
  - `Context`
  - `Decision`
  - `Action`
  - `Risk`
  - `Client Message`
  - `MDR`
  - `Instruction Card`
  - `Visibility`

- 주요 handoff 기준:
  - Product Planning -> PM: refined request + 우선순위 + 수용기준 + MDR
  - PM -> CTO: 범위/포함·제외/비기능요구/의존성/ETA
  - CTO -> Dev: 기술 경계/검증 포인트/롤백 방향
  - Dev -> Design Review/QA: 변경 파일 + 체크 포인트 + known risk
  - QA -> Report: verdict + 고객 영향 + known issue + `post_job_audit` 확인

## 5) 운영 리듬

- Weekly:
  - CEO/CTO/Tech Leader/팀장 운영 의사결정 회의
  - Design Ops / Marketing 경제지표 및 UX 레퍼런스 리뷰
  - QA / Infrastructure 릴리즈 리스크 점검

- Monthly:
  - `THIRD_PARTY_REVIEW_YYYY-MM-DD.md` 작성
  - DB 복구 드릴 실행
  - Technology Lead 기술 트렌드 리뷰 및 팀 정책 정합성 점검

## 6) 실패 방지 가드레일

- `queued 30분`, `dispatching 5분`, `in_progress 60분` 초과 작업은 자동 복구/에스컬레이션 대상
- `Local Trust Mode=ON`에서는 로그인/토큰을 기본 비활성화하되 `owner_id`는 자동 보정
- `manual_pre/manual_post/manual_both` 승인 게이트 우회 금지
- `Design Review`, `QA verdict`, `post_job_audit`, `Codex Preflight` 치명 이슈 해결 전 릴리즈 금지
- 실패 작업은 `원인-조치-재발방지` 형태로 감사로그에 남긴다.

## 7) 빠른 검토용 핵심 문서

- 역할 요약표: `docs/TEAM_ROLE_MATRIX.md`
- 회사 규약: `AGENTS.md`
- 팀 규약 인덱스: `teams/AGENTS.md`
- 런타임 엔트리포인트: `scripts/orchestrator_server.py`
- 운영 점검: `scripts/tech_leader_audit.sh`, `scripts/docs_sync_check.py`, `scripts/team_policy_check.py`

## 8) 팀별 AGENTS 할당 경로

- `teams/executive-ceo/AGENTS.md`
- `teams/executive-cto/AGENTS.md`
- `teams/business-strategy/AGENTS.md`
- `teams/marketing/AGENTS.md`
- `teams/product-planning/AGENTS.md`
- `teams/project-manager/AGENTS.md`
- `teams/engineering-backend/AGENTS.md`
- `teams/engineering-frontend/AGENTS.md`
- `teams/engineering-app/AGENTS.md`
- `teams/design-ops/AGENTS.md`
- `teams/security-ops/AGENTS.md`
- `teams/quality-assurance/AGENTS.md`
- `teams/infrastructure/AGENTS.md`
- `teams/technology-lead/AGENTS.md`

## 9) 로컬 운영 통제 모델

- Owner / Local Trust: `state/owner_config.json` + `app_settings.local_trust_mode` 기준 운영
- Repository Policy: `state/agent_company.db`의 `repo_policies`, `app_settings`
- Audit Trail: `state/agent_company.db (table: audit_events)` append-only 기록
- Runtime State: `state/agent_company.db`의 `requests`, `jobs`, `agent_status`, `usage_stats`
- Required Gates: approval modes, `Design Review`, `QA verdict`, `post_job_audit`, `Codex Preflight`
- Standard Verification Order: `API smoke -> flow smoke -> Codex canary -> Playwright 브라우저 E2E -> visual/theme regression`
