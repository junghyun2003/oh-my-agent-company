# Personal Agent Company (Local Codex)

개인이 로컬 PC에서 클라이언트 요청을 접수하고, 에이전트 조직으로 처리한 뒤, 승인/응대까지 완료할 수 있도록 만든 운영 템플릿입니다.

## 1) 핵심 개념
- 운영자(Owner): 기본 `owner` (대시보드에서 변경 가능)
- 파이프라인: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Infra) -> QA -> Report`
- 승인 게이트: `auto`, `manual_pre`, `manual_post`, `manual_both`
- 권한정책: 허용 저장소/수정경로/허용 액션 통제
- 감사로그: 누가/무엇을/어떻게 변경했는지 추적
- 완료 후 감사: 각 작업 완료 직후 `post_job_audit` 자동 생성

## 2) 빠른 시작
```bash
cd <repo-root>
python3 scripts/orchestrator_server.py
```

대시보드:
- `http://localhost:18765/dashboard/`

포트 변경:
```bash
ORCHESTRATOR_PORT=19090 python3 scripts/orchestrator_server.py
```

경로 이식성:
- 서버 시작 시 현재 `<repo-root>` 경로를 `repo_policies`에 자동 등록/활성화합니다.
- 따라서 다른 PC에서 저장소 위치가 달라도 별도 절대경로 수정 없이 실행 가능합니다.

## 3) 대시보드 사용 순서
1. `클라이언트 요청 접수`: 원문 요청 등록
2. `작업 할당`: 요청 선택, 정제 지시 작성, 저장소/승인 모드 지정
3. `실행 상태`: 파이프라인 단계와 에이전트 상태 확인
4. `승인 처리`: pre/post 승인 대기 작업 승인
5. `응대 완료`: 클라이언트 응답 메시지 남기고 상태 종료
6. `감사 로그`: 전체 이력 검증

## 4) 운영 설정 파일
- `state/agent_company.db (table: owner_config)`
  - Owner 모드 및 owner_id 설정
- `state/agent_company.db (table: repo_policies + app_settings)`
  - 허용 저장소(`path`)
  - 허용 액션(`allowed_actions`)
  - 수정 경로(`writable_paths`)
  - 기본 승인 모드(`default_approval_mode`)
- `state/agent_company.db (table: usage_stats)`
  - 로컬 운영 사용량 누적(대시보드 상단 표시)

## 5) 데이터베이스 스키마
- `state/agent_company.db (table: requests)`: 요청 큐
- `state/agent_company.db (table: jobs)`: 작업 큐/단계/노트/승인상태
- `state/agent_company.db (table: agent_status)`: 팀 운영 상태
- `state/agent_company.db (table: audit_events)`: 감사 이벤트 (append-only)
- `deliverables/job-<id>.md`: 결과 리포트

## 6) 팀 역할 문서
- 총괄: `AGENTS.md`
- 팀 인덱스: `teams/AGENTS.md`
- 팀별 역할: `teams/*/AGENTS.md`
- 운영 정책 검토: `POLICY_REVIEW.md`

## 7) 기본 운영 원칙
- Owner 검증 실패 요청은 거부
- 정책에 없는 저장소/경로 변경은 거부
- 승인 모드가 요구하면 승인 전 단계 진행 금지
- 실패/승인/완료 이벤트는 모두 감사로그 기록

## 8) 트러블슈팅
- 포트 충돌: 기존 서버 종료 후 재실행
  - `pkill -f scripts/orchestrator_server.py`
- 대시보드 갱신 이상: 새로고침 후 `감사 로그`/`사용량` API 확인
- 정책 오류: `state/agent_company.db (table: repo_policies + app_settings)` 경로/권한 재검토

## 9) 다른 사용자 적용 방법
1. 저장소 복제
2. `state/agent_company.db (table: owner_config)`에서 owner_id 교체
3. 서버 1회 실행(현재 경로가 `repo_policies`에 자동 등록됨)
4. 서버 실행 후 대시보드 접속
5. 샘플 요청으로 end-to-end 검증
