# Team Role Matrix

빠르게 팀 구성을 검토할 때 보는 요약표입니다. 상세 정책은 각 `teams/*/AGENTS.md`를 기준으로 하며, 승인/감사/큐(`queue`) 복구 기준은 각 팀의 Mandatory Gate와 함께 읽습니다.

| Team | Primary Stage | Position Fit | Critical Metric | Mandatory Gate | Primary Handoff |
| --- | --- | --- | --- | --- | --- |
| CEO | Report | 최종 우선순위/클라이언트 전달 결정 | `Design Review + QA verdict + post_job_audit` 누락 0건 | 고위험/정체 작업의 최종 승인 | Marketing, QA 근거를 반영한 최종 응답 |
| CTO | CTO | 기술 실행안/롤백 방향 총괄 | A/B 대체안과 롤백 방향 기록률 | PM 패키지 완비 전 Dev 금지 | Backend/Frontend/App/Infra/QA |
| Business Strategy | PM 이전/보조 | 가치/ROI/KPI 기준선 정리 | 우선순위 근거와 KPI 기준선 유지 | 가치 가설 없는 handoff 금지 | Product Planning, PM, CEO |
| Marketing | Report 전후 | 고객 메시지/포지셔닝 정제 | `한 줄 가치제안 + 3개 핵심 강점` 일관성 | 4블록 응답 템플릿 누락 금지 | CEO, README, 외부 메시지 |
| Product Planning | PM 이전 | `raw_request -> refined_request` 정제 | 우선순위/수용기준 누락 0건 | refined request 없이 PM 금지 | Project Manager |
| Project Manager | PM | 범위/의존성/ETA 잠금 | PM 패키지 완성도 | `긴급/중요/의존성` 누락 시 CTO 금지 | CTO |
| Engineering Backend | Dev | 상태 전이/API/데이터 무결성 구현 | 상태 전이 문서+테스트 동기화 | 규칙 변경 시 검증 누락 금지 | QA, Infrastructure |
| Engineering Frontend | Dev | UI 구현/상호작용 안정화 | 공통 컴포넌트/토큰 재사용률 | Design Ops 검토 없는 UI 완료 금지 | Design Ops, QA |
| Engineering App | Dev | 모바일 영향 평가/API 계약 안정화 | API 계약 영향 메모 유지 | 앱 영향 평가 없는 완료 금지 | QA, CTO |
| Design Ops | Dev + Design Review | UX/정보구조/테마 정책 집행 | `Design Review verdict` 기록률 | 디자인 영향 변경 시 필수 개입 | Frontend, QA, CEO |
| Security Ops | Dev + QA 지원 | 민감정보/권한/입력 검증 점검 | 위험도 분류와 완화 조치 기록률 | `high` 위험 이슈 미해결 릴리즈 금지 | QA, CTO, CEO |
| Quality Assurance | QA | 배포 게이트/검증 결과 확정 | `pass/block/waive` 구조화 + 증거 유지 | E2E/canary/post audit 누락 금지 | Report, CEO |
| Infrastructure | Dev 지원 + 운영 | 런타임/복구/Preflight 안정화 | `process + port + api` 헬스 재현성 | 치명 `Codex Preflight` 이슈 방치 금지 | CTO, QA, Executive |
| Technology Lead | CTO 지원 + Dev/QA 가이드 | 전사 기술 정책/릴리즈 게이트 정렬 | `정책-코드-검증` 불일치 탐지율 | 정책/구현/검증 불일치 시 보류 권고 | CEO, CTO, Team Leads |
