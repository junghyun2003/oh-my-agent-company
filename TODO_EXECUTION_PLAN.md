# TODO Execution Plan (2026-02-22 Refresh)

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

## Current Step Set (v2)
- Step 1. 서버 상시 가용성 고정
- Step 2. 서버 다운 원인 자동 진단 리포트
- Step 3. Ops API 권한/입력 검증 강화
- Step 4. DB 안정성(마이그레이션/백업) 도입
- Step 5. 핵심 화면 라우팅/새로고침 UX 정리
- Step 6. 다크/라이트/시스템 테마 전수 QA
- Step 7. 작업할당/승인 UI 깨짐 방지 공통화
- Step 8. 감사로그 검색성 개선
- Step 9. 시간 표기 표준화(일자+시간+타임존)
- Step 10. 정책 문서 동기화 자동 검증
- Step 11. E2E/시각 회귀 자동화 확대
- Step 12. 외부 사용자 온보딩 가이드 강화

## Operator Routine
```bash
# 1) 다음 단계 확인
python3 scripts/todo_workflow.py list

# 2) 단계 시작
python3 scripts/todo_workflow.py start 1

# 3) 코드 수정/검증 후 완료
python3 scripts/todo_workflow.py complete 1 --verify --commit --push
```
