# Process Review & Policy Decision (2026-02-21)

## Objective
- 현재 업무 프로세스가 실제 운영/고객 응대에 적합한지 검토
- 팀 의견을 반영해 클라이언트 친화 정책으로 재정렬

## Discussion Summary
1. 현행 강점
- 파이프라인(`PM -> CTO -> Dev(병렬) -> QA -> Report`)은 일관되게 동작
- 승인 게이트/감사로그로 추적성 확보

2. 문제 지점
- 작업 완료 후 클라이언트 메시지 품질이 작성자 편차에 따라 달라짐
- QA/감사 결과가 클라이언트 설명문으로 직접 연결되지 않음

3. 우선순위 원칙
- 팀 의견 충돌 시 CEO 판단을 최우선으로 정책에 반영

## Policy Decisions
- 결정 1: 클라이언트 응답을 4블록 템플릿으로 표준화
  - `변경점`, `영향`, `리스크`, `다음 조치`
- 결정 2: Report 단계에서 클라이언트 전달 메시지 초안을 자동 생성
- 결정 3: 요청 응대 API는 비정형 텍스트 입력 시에도 4블록 형태로 정규화
- 결정 4: 완료 후 감사(`post_job_audit`)에 클라이언트 메시지 템플릿을 함께 기록

## Implementation Notes
- 코드 반영: `scripts/orchestrator_server.py`
- 규약 반영: `AGENTS.md`, `README.md`, `teams/AGENTS.md`, `teams/executive-ceo/AGENTS.md`, `teams/marketing/AGENTS.md`
- 근거 문서: `TEAM_FEEDBACK_2026-02-21.md`, `POLICY_REVIEW.md`
