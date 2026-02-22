# TODO Execution Plan (2026-02-22 v6)

운영 고도화 TODO(v6)를 단계별로 실행하고 매 단계 커밋/푸시한다.

## Core Rule
1. 하나의 단계만 `in_progress`.
2. `files` 범위 안에서만 수정.
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

## Step Set (v6)
1. 로컬 CI 체크 스크립트 추가
2. 시각회귀 기준 정책 보강
3. 대시보드 경량 로딩 모드 추가
4. incident 알림 재시도/백오프 추가
5. 보안 스캔 allowlist 지원
6. KPI 리포트 히스토리 저장
7. pre-commit 문서 검증 훅 추가
8. 언어 정책 자동 점검 스크립트 추가
9. 10분 온보딩 문서 추가
10. API 계약 스모크 테스트 추가
