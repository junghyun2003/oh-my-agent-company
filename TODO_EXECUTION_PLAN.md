# TODO Execution Plan (2026-02-22 v3)

이 문서는 로컬 에이전트 회사 운영 개선 TODO를
`한 단계 실행 -> 검증 -> 커밋 -> 푸시` 방식으로 수행하기 위한 실행 규약이다.

## Core Rule
1. 동시에 하나의 단계만 `in_progress` 상태로 둔다.
2. 단계별 수정은 `TODO_TRACKER.json`의 `files` 범위 안에서만 진행한다.
3. 단계 완료 전에 `verify` 명령을 전부 통과시킨다.
4. 통과 후 즉시 커밋/푸시한다.
5. 커밋 본문에는 provenance footer를 반드시 유지한다.

## Workflow Commands
```bash
python3 scripts/todo_workflow.py list
python3 scripts/todo_workflow.py start <step_id>
python3 scripts/todo_workflow.py complete <step_id> --verify --commit --push
```

## Commit Format
```text
type(scope): summary

Change-Origin: custom
Upstream-Ref: none
```

## Current Step Set (v3)
- Step 1. infra 재시작 플랩 원인 고정
- Step 2. 서버 수명 추적 API 추가
- Step 3. 워커 헬스 분리 지표 추가
- Step 4. Ops Queue 감사 상세(before/after) 강화
- Step 5. 작업할당/승인 폼 사전 검증 강화
- Step 6. 감사로그 대량 데이터 성능 개선
- Step 7. 픽셀 실행상태 대시보드 고도화
- Step 8. 문서-코드 불일치 pre-push 강제
- Step 9. DB 백업 운영 정책 고정
- Step 10. 온보딩 단일 bootstrap 명령 추가
- Step 11. Playwright 시각회귀 본격 도입
- Step 12. 포크 변경 추적 자동 리포트 개선

## Operator Routine
```bash
# 1) 다음 단계 확인
python3 scripts/todo_workflow.py list

# 2) 단계 시작
python3 scripts/todo_workflow.py start 1

# 3) 코드 수정/검증 후 완료
python3 scripts/todo_workflow.py complete 1 --verify --commit --push
```
