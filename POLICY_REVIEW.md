# Policy Review (2026-02-21)

## Scope
- 운영 정책 재검토
- 작업 완료 후 감사 실행 정책 명시
- 디자인팀 신설 반영 여부 점검

## Findings
1. 디자인팀 신설 요청은 UI 보드에만 존재했고, 실제 `agent_status` 시드/파이프라인에는 `design` 에이전트가 없었다.
2. 작업 완료 이후의 개선 루프는 감사 로그에 명시 규칙이 부족했다.
3. 팀 구조 문서에 Design Ops 항목이 없어 역할/핸드오프 기준이 누락돼 있었다.

## Decisions
1. 파이프라인 Dev 병렬 범위를 `Backend/Frontend/App/Design/Infra`로 공식화한다.
2. 각 작업 완료 시 `post_job_audit` 이벤트를 `audit_events`에 append-only로 기록한다.
3. `teams/design-ops/AGENTS.md`를 신설해 Design Ops 책임과 감사 필드를 정의한다.

## Enforced Rules
- Owner mode 검증(`owner_id`) 실패 시 write API 거부
- `repo_policies`/`app_settings` 기반 저장소·경로·액션 통제
- 승인 모드(`auto/manual_pre/manual_post/manual_both`) 게이트 강제
- 감사 로그 append-only 유지(`audit_events`)
- 완료 후 감사 의무화(`job_done` 뒤 `post_job_audit` 생성)
- 팀 의견 충돌 시 `CEO 의견 > CTO > Product/QA > 기타 팀` 우선순위로 정책을 결정

## Operational Checklist
- 대시보드 감사 로그에서 `post_job_audit` 필터로 개선 권고 확인
- 정체 작업(`queued`, `in_progress`)과 실패율을 완료 후 감사에서 점검
- Design Ops가 Dev 단계에서 Frontend와 함께 UX 회귀 위험을 기록

## Team Consensus (2026-02-21)
- 근거 문서: `TEAM_FEEDBACK_2026-02-21.md`
- 우선 원칙: CEO 의견을 최우선 반영한다.
- 합의 1: `post_job_audit`에 실패 재발방지 섹션을 의무화한다.
- 합의 2: Dev 착수 전 실행 커맨드/경로 정책 검증 결과를 감사로그에 남긴다.
- 합의 3: QA 결과를 `pass/block/waive` 형태로 구조화한다.
- 합의 4: 클라이언트 응답은 고정 템플릿(변경점/영향/리스크/다음조치)으로 작성한다.
- 합의 5: Design Ops(정보구조/가독성)와 Frontend(구현/상호작용) 책임 경계를 고정한다.
- 합의 6: Report 단계에서 클라이언트 전달 메시지 초안을 자동 생성해 요청 레코드에 저장한다.
- 합의 7: 과도한 요구도 거절 대신 MDR(최소 납품 결과) 기준으로 단계 제공한다.
- 합의 8: 제3자 사용성 리뷰를 월 1회 수행하고, 개선 항목을 다음 릴리즈에 최소 1개 반영한다.
- 합의 9: `Security Ops Team`을 신설하고 Dev 병렬 단계에 보안 점검을 포함한다.
