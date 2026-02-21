# oh-my-agnet-company (Local Codex)

개인이 로컬 PC에서 클라이언트 요청을 접수하고, 에이전트 조직으로 처리한 뒤, 승인/응대까지 완료할 수 있도록 만든 운영 템플릿입니다.

## Global Pitch (EN)
- Run `oh-my-agnet-company` locally with clear governance.
- Turn client requests into traceable delivery via a structured pipeline.
- Keep speed and reliability together with approvals, audits, and client-ready reporting.

## 왜 외부 고객에게 어필되는가
1. 빠르지만 통제 가능
- 병렬 Dev 파이프라인 + 승인 게이트로 속도와 품질을 함께 관리합니다.

2. 신뢰 가능한 운영 로그
- append-only 감사 이벤트로 요청부터 납품까지 추적 가능합니다.

3. 클라이언트 친화 결과물
- 응대 메시지 4블록 템플릿(변경점/영향/리스크/다음 조치)으로 전달 품질을 표준화합니다.

## 1) 핵심 개념
- 운영자(Owner): 기본 `owner` (대시보드에서 변경 가능)
- 파이프라인: `PM -> CTO -> Dev(병렬: Backend/Frontend/App/Design/Security/Infra) -> QA -> Report`
- 승인 게이트: `auto`, `manual_pre`, `manual_post`, `manual_both`
- 권한정책: 허용 저장소/수정경로/허용 액션 통제
- 감사로그: 누가/무엇을/어떻게 변경했는지 추적
- 완료 후 감사: 각 작업 완료 직후 `post_job_audit` 자동 생성
- 클라이언트 응답 템플릿: `변경점/영향/리스크/다음 조치` 4블록 기본

## 2) 빠른 시작
```bash
cd <repo-root>
python3 scripts/orchestrator_server.py
```

대시보드:
- `http://localhost:18765/`
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
- 마케팅 실행 가이드: `MARKETING_PLAYBOOK.md`
- 공통 컴포넌트 정책: `COMPONENT_REGISTRY.md`

## 7) 기본 운영 원칙
- Owner 검증 실패 요청은 거부
- 정책에 없는 저장소/경로 변경은 거부
- 승인 모드가 요구하면 승인 전 단계 진행 금지
- 실패/승인/완료 이벤트는 모두 감사로그 기록
- 팀별 의견 수렴 문서(`TEAM_FEEDBACK_YYYY-MM-DD.md`)를 주기적으로 작성하고 정책에 반영
- 팀 의견 충돌 시 의사결정 우선순위는 `CEO > CTO > Product/QA > other teams`
- Dev 착수 전 실행 커맨드/경로 검증 결과를 감사로그에 기록
- QA 결과는 `pass/block/waive` 형태로 구조화
- 클라이언트 응답은 4블록 템플릿(변경점/영향/리스크/다음 조치)을 사용
- 무리한 클라이언트 요구에도 거절 대신 범위 분해/단계 납품/MDR 제시를 기본 정책으로 적용
- 디자인/마케팅 팀은 월 1회 이상 공식 경제지표(BLS/BEA/Federal Reserve)와 UX 레퍼런스를 업데이트해 UI/메시지 의사결정에 반영
- C-Level 제외 모든 팀은 팀장(Lead Agent)을 두고, 외부 레퍼런스 기반 정책/업무 정제를 수행
- Tech Leader Agent가 전사 기술 리딩과 문서 업데이트(팀별 AGENTS.md 정합성)를 총괄
- Design Ops + Frontend는 공통 컴포넌트 레지스트리를 유지해 재사용성과 UI 일관성을 관리

## OSS 라이선스
- License: `MIT`
- 상업적 사용/수정/배포가 가능하며, 저작권 고지와 라이선스 고지를 포함해야 합니다.

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

## 10) 운영 회고 문서
- 정책 리뷰: `POLICY_REVIEW.md`
- 팀 의견 수렴(최신): `TEAM_FEEDBACK_2026-02-21.md`
- 프로세스 의사결정(최신): `PROCESS_REVIEW_2026-02-21.md`
- 제3자 사용성 프레임: `THIRD_PARTY_READINESS.md`
- 제3자 리뷰 템플릿: `THIRD_PARTY_REVIEW_TEMPLATE.md`

## 11) 제3자 사용성 운영 루프
1. 월 1회 `THIRD_PARTY_REVIEW_YYYY-MM-DD.md`를 템플릿 기반으로 작성
2. 준비도 점수와 주요 불편 Top 3를 팀별로 합의
3. 다음 릴리즈에 개선 항목 최소 1개 이상 반영
4. 반영 결과를 `POLICY_REVIEW.md` 또는 `PROCESS_REVIEW_*.md`에 기록

## 12) CEO/CTO 정책 업그레이드
- 서비스 연속성: 요청 실패가 서버 전체 중단으로 이어지지 않도록 운영
- Executive 에스컬레이션: 정체/실패 작업은 CEO/CTO 판단 대상으로 즉시 승격
- CTO 리스크 제시: 고위험 변경 시 대체안(A/B) + 롤백 방향 필수
- CEO 전달 품질: 클라이언트 응답 템플릿 품질을 최종 승인
- 릴리즈 의무: 매 릴리즈 안정성/사용성 개선 1건 이상 반영
