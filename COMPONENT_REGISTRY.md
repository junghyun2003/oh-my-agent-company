# Component Registry Policy

`oh-my-agent-company`의 UI/UX 일관성을 위해 공통 컴포넌트 분리 기준을 정의한다.

## 목적
- 중복 UI 코드를 줄이고, 변경 비용을 낮춘다.
- Design Ops/Frontend가 동일한 컴포넌트 기준으로 협업한다.

## 운영 원칙
- 새로운 화면/패널 구현 시 기존 컴포넌트 재사용 여부를 먼저 검토한다.
- 반복되는 UI 패턴은 2회 이상 발견되면 공통 컴포넌트 후보로 등록한다.
- 컴포넌트 변경은 `변경 이유/영향 범위/롤백 방법`을 함께 기록한다.

## 컴포넌트 후보 분류
- `Navigation`: 사이드바 메뉴, 플로우 탭, helper 카드
- `Data Display`: table, metric card, tag, status badge
- `Workflow`: intake form, approval form, kanban card
- `Feedback`: alert, muted hint, loading/error message

## 현재 공통 컴포넌트(적용 중)
- `Form Select` (`.control-select`): 작업할당/승인/운영 액션 드롭다운 공통 스타일
  - 목적: 드롭다운 높이/정렬/테마 색상 일관화
  - 적용 대상: `requestSelect`, `repoSelect`, `jobPriority`, `ops*`, `approve*`
  - 소유: Frontend Team Lead + Design Team Lead

## 팀 역할
- Design Team Lead: 정보구조/가독성/시각 규칙 관리
- Frontend Team Lead: 구현 규칙/접근성/재사용 API 관리
- Tech Leader Agent: 팀 간 컴포넌트 표준 충돌 조정 및 정책 승인안 작성

## 리뷰 루프
- 주 1회: 신규 중복 UI 후보 점검
- 월 1회: 컴포넌트 레지스트리 업데이트 및 팀 정책 반영
