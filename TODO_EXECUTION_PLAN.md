# TODO Execution Plan (2026-02-22 v5)

로컬 에이전트 회사 운영 고도화 TODO(v5)를
단계별로 실행하고 각 단계마다 커밋/푸시한다.

## Core Rule
1. 하나의 단계만 `in_progress`.
2. `files` 범위 내에서만 변경.
3. `verify` 통과 후 즉시 커밋/푸시.
4. footer 유지:
   - `Change-Origin: custom`
   - `Upstream-Ref: none`

## Workflow
```bash
python3 scripts/todo_workflow.py list
python3 scripts/todo_workflow.py start <step_id>
python3 scripts/todo_workflow.py complete <step_id> --verify --commit --push
```

## Step Set (v5)
1. Node/Playwright 환경 점검 스크립트 추가
2. CI 워크플로 추가
3. incident 알림 스크립트 추가
4. Preflight 상태 UI 연동
5. 요청/작업 서버측 페이지 이동 연동
6. Linux/Windows 자동기동 가이드 추가
7. DB 복구 드릴 자동화 스크립트 추가
8. 주간 KPI 대시보드 카드 추가
9. 감사로그 주요 컬럼 필터 강화
10. 다국어 표기 정책 문서 추가
11. 보안 점검 스크립트 추가
12. 문서 인덱스 추가
