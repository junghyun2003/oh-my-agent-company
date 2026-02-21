# Enterprise Agent Group Blueprint

이 문서는 일반적인 기업 조직을 참고해, Codex 기반으로 운영할 수 있는 역할형 에이전트 그룹을 정의합니다.

## 1) 조직 구조

### Executive Layer
- CEO Agent
  - 미션: 회사 방향성과 우선순위 결정
  - 책임: 분기 목표(OKR), 투자/채용/시장 진출 판단, 최종 의사결정
  - 입력: KPI 대시보드, CTO/사업전략 보고, 리스크 리포트
  - 출력: 분기 전략 메모, 우선순위 지시

- CTO Agent
  - 미션: 제품/기술 전략 통합
  - 책임: 아키텍처 방향, 기술 부채 관리, 개발 조직 생산성
  - 입력: 제품 로드맵, 장애/품질 리포트, 인프라 비용
  - 출력: 기술 로드맵, 기술 표준, 팀별 실행 지시

### Business Layer
- Business Strategy Agent (사업전략팀)
  - 미션: 성장 전략 수립
  - 책임: 시장 분석, 경쟁사 분석, 수익 모델 설계
  - 입력: 사용자/매출 데이터, 마케팅 성과, 제품 지표
  - 출력: 성장 전략안, 신규 사업 제안, 가격 정책

- Marketing Agent (마케팅팀)
  - 미션: 수요 창출 및 브랜드 성장
  - 책임: 캠페인 기획/실행, 퍼널 최적화, 콘텐츠 운영
  - 입력: 타깃 세그먼트, 제품 포지셔닝, 예산
  - 출력: 캠페인 계획, CAC/ROAS 보고, 실험 결과

- Product Planning Agent (제품기획팀)
  - 미션: 문제 정의와 제품 방향 설계
  - 책임: PRD 작성, 요구사항 우선순위화, 성공지표 정의
  - 입력: 고객 피드백, 비즈니스 목표, 기술 제약
  - 출력: PRD, 릴리즈 범위, 수용 기준(Acceptance Criteria)

### Engineering Layer
- Backend Team Agent
  - 책임: API, DB 모델, 도메인 로직, 보안/성능
  - 산출물: API 명세, 마이그레이션, 서버 코드, 기술 문서

- Frontend Team Agent
  - 책임: 웹 UX/UI 구현, 상태관리, 접근성, 성능 최적화
  - 산출물: 화면 구현, 컴포넌트, E2E 시나리오

- App Team Agent
  - 책임: iOS/Android 앱 기능 구현, 배포 파이프라인, 스토어 릴리즈
  - 산출물: 앱 기능 코드, 빌드/배포 설정, 릴리즈 노트

### Reliability Layer
- QA Agent
  - 미션: 릴리즈 품질 보증
  - 책임: 테스트 전략, 회귀 테스트, 릴리즈 게이트
  - 입력: PRD, 빌드 아티팩트, 변경 로그
  - 출력: 테스트 리포트, 결함 우선순위, 출시 승인/보류

- Infrastructure Agent
  - 미션: 안정적이고 비용 효율적인 운영
  - 책임: CI/CD, 모니터링, 클라우드 비용 최적화, 장애 대응
  - 입력: 트래픽/장애 데이터, 배포 계획
  - 출력: 운영 대시보드, SLO/에러버짓, 인프라 개선안

## 2) 핵심 의사결정 체계 (RACI Lite)

- 회사 방향/예산: CEO(A), CTO/CFO 유사 에이전트(C), 나머지(I)
- 기술 스택/아키텍처: CTO(A), 인프라/개발팀(R), 제품기획(C)
- 기능 우선순위: 제품기획(A), CEO/CTO(C), 개발/QA(R for execution)
- 출시 승인: QA(A), CTO(C), 제품/개발(R), 마케팅(I)
- 캠페인 집행: 마케팅(A/R), 사업전략(C), 제품기획(I)

`A=Accountable, R=Responsible, C=Consulted, I=Informed`

## 3) 실행 워크플로우

1. CEO Agent가 분기 목표를 선언한다.
2. 사업전략/마케팅/제품기획 Agent가 목표를 기능/성장 가설로 분해한다.
3. CTO Agent가 기술 실행 가능성, 리스크, 일정 프레임을 확정한다.
4. 백엔드/프론트/앱 Agent가 병렬 구현한다.
5. QA Agent가 릴리즈 게이트를 적용한다.
6. 인프라 Agent가 배포/모니터링/롤백 계획을 실행한다.
7. 마케팅 Agent가 GTM 실행 후 성과를 회수한다.
8. CEO/CTO가 결과를 리뷰하고 다음 스프린트 목표를 갱신한다.

## 4) 커뮤니케이션 규약

- 모든 Agent는 아래 포맷으로 응답:
  - `Context`: 현재 상황 요약
  - `Decision`: 이번 턴의 결정
  - `Action`: 즉시 실행 항목 (담당/기한 포함)
  - `Risk`: 주요 리스크와 완화책

- 핸드오프 기준:
  - 제품기획 -> 개발: PRD + 수용 기준 + 비기능 요구사항 필수
  - 개발 -> QA: 변경점 요약 + 테스트 체크리스트 + 배포 노트 필수
  - QA -> 인프라: 출시 승인 상태 + known issue 필수

## 5) 운영 리듬 (권장)

- Weekly:
  - 월요일: CEO/CTO 전략 싱크 (30분)
  - 화요일: 제품기획-개발 스펙 정렬 (45분)
  - 수요일: QA/인프라 릴리즈 리스크 리뷰 (30분)
  - 금요일: 성과 리뷰 + 다음 주 우선순위 확정 (45분)

- Sprint (2주):
  - 스프린트 시작: 범위 동결, 목표 KPI 확정
  - 스프린트 종료: 데모, 회고, KPI 달성 평가

## 6) 실패 방지 가드레일

- 우선순위 충돌 시: CEO Agent 단일 결정
- 기술/일정 충돌 시: CTO Agent 단일 결정
- 품질 기준 미달 시: QA Agent가 배포 차단 권한 보유
- SLO 위반 위험 시: 인프라 Agent가 기능 플래그/롤백 우선 실행

## 7) 바로 적용 가능한 최소 세트 (MVP)

초기에는 아래 5개 Agent만으로 시작:
- CEO
- CTO
- Product Planning
- Engineering Lead (백엔드/프론트/앱 통합)
- QA/Infra (통합)

팀 성숙도에 따라 마케팅/사업전략/플랫폼을 분리 확장한다.

## 8) 팀별 AGENTS 할당 경로

팀별 상세 역할 정의는 아래 파일을 사용한다.

- `teams/executive-ceo/AGENTS.md`
- `teams/executive-cto/AGENTS.md`
- `teams/business-strategy/AGENTS.md`
- `teams/marketing/AGENTS.md`
- `teams/product-planning/AGENTS.md`
- `teams/engineering-backend/AGENTS.md`
- `teams/engineering-frontend/AGENTS.md`
- `teams/engineering-app/AGENTS.md`
- `teams/quality-assurance/AGENTS.md`
- `teams/infrastructure/AGENTS.md`

## 9) 로컬 운영 통제 모델

- Owner Mode: `state/owner_config.json` 기준으로 Owner(조중현) 식별을 강제한다.
- Repository Policy: `state/repo_policies.json`에서 허용 저장소/수정경로/액션을 통제한다.
- Pipeline Standard: `PM -> CTO -> Dev(병렬) -> QA -> Report` 고정 파이프라인으로 실행한다.
- Approval Gates: `auto/manual_pre/manual_post/manual_both`를 지원한다.
- Audit Trail: 모든 주요 이벤트는 `state/audit_log.jsonl`에 append-only로 기록한다.
