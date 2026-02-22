# TODO Execution Plan (Step-by-Step Commit/Push)

이 문서는 로컬 에이전트 회사 운영 개선 TODO를
`한 단계 실행 -> 검증 -> 커밋 -> 푸시` 방식으로 수행하기 위한 트래커다.

## Execution Rule
1. 한 번에 한 단계만 `in_progress` 상태로 둔다.
2. 단계 완료 시 검증 명령을 실행한다.
3. 검증 통과 후 즉시 커밋/푸시한다.
4. 커밋 메시지는 `type(scope): summary` + provenance footer를 사용한다.

## Workflow Commands
```bash
python3 scripts/todo_workflow.py list
python3 scripts/todo_workflow.py start <step_id>
python3 scripts/todo_workflow.py complete <step_id> --verify --commit --push
```

- 단계 상태는 `TODO_TRACKER.json`이 source of truth다.
- `complete`는 단계별 파일 목록만 스테이징하여 커밋한다.

## Step Checklist
- [x] Step 1. 큐 운영 스크립트 추가 (`scripts/ops_queue_manager.py`)
- [ ] Step 2. 서버 자동 정체 복구 루프 내장 (`scripts/orchestrator_server.py`)
- [ ] Step 3. 멀티 워커 동시 처리 + 안전 디스패치 락 (`scripts/orchestrator_server.py`)
- [ ] Step 4. 운영 API 추가 (`/api/ops/queue` 조회/관리)
- [ ] Step 5. 대시보드 운영 패널(백로그/진행중/실패 액션)
- [ ] Step 6. 회귀 테스트/스모크 테스트 자동화

## Step 1 Outcome
- Added:
  - `scripts/ops_queue_manager.py`
- Updated:
  - `README.md` (운영 명령 추가)
  - `AGENTS.md` (운영 루틴 명령 표준화)
  - `package.json` (npm 스크립트 추가)

## Verification Commands
```bash
python3 scripts/ops_queue_manager.py summary
python3 scripts/ops_queue_manager.py apply --dry-run
```

## Commit Template
```text
feat(infra): add ops queue manager for backlog and stalled jobs

Change-Origin: custom
Upstream-Ref: none
```
