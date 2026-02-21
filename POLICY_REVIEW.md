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

## Operational Checklist
- 대시보드 감사 로그에서 `post_job_audit` 필터로 개선 권고 확인
- 정체 작업(`queued`, `in_progress`)과 실패율을 완료 후 감사에서 점검
- Design Ops가 Dev 단계에서 Frontend와 함께 UX 회귀 위험을 기록
