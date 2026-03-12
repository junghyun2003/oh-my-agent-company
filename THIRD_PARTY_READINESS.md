# Third-Party Readiness Framework

## 목적
- `oh-my-agent-company`를 제3자가 바로 설치/운영/확장할 수 있는 상태를 유지한다.
- 기능 추가보다 먼저 "이해 가능성/재현 가능성/운영 안정성"을 관리한다.

## 검토 주기
- 매주: 운영 체크(장애, 온보딩 실패, 클라이언트 불만)
- 매월: 제3자 사용성 리뷰(전체 팀 참여)
- 분기: 정책 재의결(CEO 우선 원칙 적용)

## 준비도 점수 (100점)
- 설치/시작 용이성(25)
- 문서 완결성(20)
- 운영 안정성(20)
- 감사 추적성(15)
- 클라이언트 응대 품질(10)
- 커스터마이징 용이성(10)

## 필수 통과 기준
1. 새로운 사용자 1명이 README만 보고 30분 내 대시보드 진입
2. 샘플 요청 1건을 `PM -> Report`까지 완료 가능
3. GitHub 저장소 변경 작업 1건이 `codex/*` 브랜치와 PR evidence까지 남김
4. 감사로그에서 `request_received -> job_assigned -> job_done` 추적 가능
5. 클라이언트 응답이 4블록 템플릿으로 저장됨
6. 실패 작업의 원인과 재발방지 조치가 문서화됨
7. `Codex canary`와 `Playwright 브라우저 E2E`를 로컬에서 재현 가능

## 팀별 검토 질문
1. CEO
- 현재 정책이 "제3자 성공 확률"을 높이는가?
- 충돌 이슈가 발생할 때 우선순위 결정이 빠른가?

2. CTO
- 초기 설치/실행의 실패 지점이 어디인가?
- 기술 부채가 제3자 확장을 막고 있는가?

3. Product
- 온보딩 흐름이 직관적인가?
- 입력 폼/할당/승인 단계가 과도하게 복잡하지 않은가?

4. Engineering(Backend/Frontend/App/Design)
- 기본 UI/기능이 설명 없이도 이해되는가?
- 변경 영향이 다른 팀에 안전하게 전달되는가?

5. QA
- 회귀 체크 항목이 명시적이고 반복 가능한가?
- `pass/block/waive` 판정 근거가 충분한가?
- 브라우저 E2E와 `post_job_audit` 검증이 실제 릴리즈 게이트에 연결되어 있는가?

6. Infrastructure
- `process + port + api` 헬스체크로 상태를 즉시 진단 가능한가?
- 로컬 환경 차이로 인한 실행 실패 대응책이 문서화됐는가?
- `Codex Preflight`가 Node/npm/npx/Playwright/Codex reasoning effort 문제를 바로 드러내는가?
- GitHub 저장소 대상 작업에서 브랜치/commit/push/PR prerequisite(`gh`, auth, remote)가 바로 드러나는가?
- 재시작 뒤 고아 `dispatching/in_progress/waiting_*` 작업이 자동 재조정되는가?

7. Marketing/Strategy
- 클라이언트 응대 메시지가 신뢰를 주는 구조인가?
- 전달 결과가 재요청 감소/만족도 증가로 이어지는가?

## 산출물
- `THIRD_PARTY_REVIEW_YYYY-MM-DD.md`
  - 점수표
  - 주요 불편 3개
  - 다음 달 개선 우선순위 3개
  - 책임팀/기한

## 운영 원칙
- "사용자가 이해하지 못하면 기능 완료가 아니다."
- "정책은 문서로 끝내지 말고 대시보드/서버 동작으로 연결한다."
- "개선 요청은 작은 단위로 끊어 매 릴리즈에 최소 1개 이상 반영한다."
