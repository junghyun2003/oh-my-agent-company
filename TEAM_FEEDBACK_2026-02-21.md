# Team Feedback Roundup (2026-02-21)

## Evidence Base
- Source DB: `state/agent_company.db`
- Sample: 최근 작업 10건 (`done=9`, `failed=1`, 평균 완료 116.8초)
- Referenced fields: `jobs.pm_notes`, `jobs.cto_notes`, `jobs.dev_notes`, `jobs.qa_notes`, `audit_events`, `agent_status`

## Team Opinions (Current Work Retrospective)
1. CEO (Executive)
- 의견: 납품 속도는 충분하지만 실패 재발 방지 규칙이 더 명확해야 함.
- 근거: `job_failed` 1건 존재, 완료율은 높음(9/10).
- 요청 정책: 실패 타입별 재발방지 체크리스트를 `post_job_audit`에 의무 첨부.

2. CTO (Executive)
- 의견: Codex 실행 인자 오류 같은 운영성 실패를 사전 차단해야 함.
- 근거: 실패 사유가 실행 인자(`-a`) 해석 오류로 기록됨.
- 요청 정책: Dev 진입 전 실행 커맨드 검증 규칙(allowlist + dry-run 메시지 검증).

3. Business Strategy
- 의견: UI/운영 개선 요청이 반복되므로 투자 우선순위를 UX 안정성에 고정할 필요.
- 근거: 최근 요청이 UI/가독성/대화 리포트 개선에 집중.
- 요청 정책: 반복 요청 카테고리(UX/운영성) 월간 Top 3를 정책 우선순위에 반영.

4. Marketing
- 의견: 클라이언트 전달용 요약은 더 구조화되어야 신뢰가 올라감.
- 근거: `client_responded` 이벤트는 있으나, 응답 품질 기준은 문서화 미흡.
- 요청 정책: 클라이언트 응답 템플릿(변경점/영향/리스크/다음조치) 고정.

5. Product Planning
- 의견: 자동 정제는 효과적이나 수용 기준 문장이 더 일관되어야 함.
- 근거: PM 노트에서 자동 정제 기능 요구가 실제 구현으로 이어짐.
- 요청 정책: `refined_request` 최소 항목(요약/주요작업/완료기준/검증방법) 필수화.

6. Backend
- 의견: 변경 경로/정책 위반 예방이 안정성의 핵심.
- 근거: 현재 정책은 경로 제한 중심, 실행 전 점검 규칙은 약함.
- 요청 정책: 작업 시작 시 `repository + writable_paths` 일치 검사 결과를 감사로그에 남김.

7. Frontend
- 의견: UX 개선은 빠르게 진행되었지만 회귀 검증 기준이 명확해야 함.
- 근거: 최근 작업 다수가 UI 개선이며 반복 수정 발생.
- 요청 정책: UI 변경 시 최소 1개 회귀 체크(레이아웃/텍스트/내비게이션) 기록 의무.

8. App Engineering
- 의견: 웹 중심 변경에서도 앱 영향도 판단 기록이 필요.
- 근거: App Dev 노트는 있으나 영향 없음/있음의 구조화가 부족.
- 요청 정책: Dev 노트에 `app_impact: none|low|high` 필드 추가.

9. Design Ops
- 의견: 디자인팀이 이제 편입되었으므로 Frontend와 공통 책임 경계를 명확히 해야 함.
- 근거: `agent_status`에 `design` 신규 등록, 과거 작업엔 디자인 역할 부재.
- 요청 정책: Design은 정보구조/가독성, Frontend는 구현/상호작용으로 1차 책임 분리.

10. QA
- 의견: QA 노트가 현재 "Regression and release checks"로 단순해 추적성이 낮음.
- 근거: 최근 완료 작업 QA 노트 패턴이 동일.
- 요청 정책: QA 결과를 `pass/block/waive` + 근거 1줄로 구조화.

11. Infrastructure
- 의견: 서버 프로세스가 살아있어도 응답 불가 상태가 발생할 수 있어 운영 감시 기준이 필요.
- 근거: 운영 중 프로세스/포트/접속 체크 불일치 사례 존재.
- 요청 정책: 헬스체크를 `process + port + api` 3단계로 표준화.

## Consensus Policy Updates
- `post_job_audit`에 실패 재발방지 섹션을 의무화한다.
- Dev 착수 전 실행 커맨드/경로 정책 검증을 감사 이벤트로 남긴다.
- QA 결과를 구조화된 상태값으로 기록한다.
- 클라이언트 응답 템플릿을 고정해 메시지 품질 편차를 줄인다.
- Design Ops와 Frontend의 책임 경계를 문서로 고정한다.

## Immediate Actions
1. `POLICY_REVIEW.md`에 합의 정책 반영
2. 팀 문서(`teams/*/AGENTS.md`)에 QA/Design/Infra 구조화 필드 반영
3. 대시보드 감사뷰에서 `post_job_audit` 중심 운영 점검
