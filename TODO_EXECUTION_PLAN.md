# TODO Execution Plan (2026-02-22 v4)

로컬 에이전트 회사 운영 미비점 보강 TODO를
`한 단계 실행 -> 검증 -> 커밋 -> 푸시` 규칙으로 수행한다.

## Core Rule
1. 동시에 하나의 단계만 `in_progress`.
2. 단계 수정 범위는 `TODO_TRACKER.json`의 `files`로 제한.
3. `verify` 통과 후 즉시 커밋/푸시.
4. 커밋 footer 유지:
   - `Change-Origin: custom`
   - `Upstream-Ref: none`

## Workflow Commands
```bash
python3 scripts/todo_workflow.py list
python3 scripts/todo_workflow.py start <step_id>
python3 scripts/todo_workflow.py complete <step_id> --verify --commit --push
```

## Current Step Set (v4)
1. 워크플로 트래커 커밋 원자화
2. Playwright 시각회귀 엄격 모드 분리
3. 포크 baseline 자동 대체 경로 추가
4. 로컬 서버 자동기동 launchd 스크립트 추가
5. 요청/작업 API 페이지네이션 지원
6. bootstrap 의존성 강제 모드 추가
7. Local Trust 모드에서 owner/token 입력 간소화
8. state 산출물 git 추적 정책 보강
9. Codex 실행 preflight 점검 API 추가
10. 주간 KPI 리포트 스크립트 추가
11. 테마 3모드 회귀 점검 스크립트 추가
12. 장애 요약 진단 커맨드 고도화
