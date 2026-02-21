# Theme Policy (Design Ops)

## Objective
- 라이트/다크/시스템 모드 간 시각 일관성과 가독성을 유지한다.
- 테마 전환 시 정보 계층(우선순위, 경고/위험, CTA)이 동일하게 인지되도록 보장한다.

## Core Rules
1. 테마는 `token-first`로 설계한다.
2. 컴포넌트에 하드코딩 색상 사용을 최소화하고, 공통 토큰을 우선 사용한다.
3. 라이트 테마는 기본 배경 대비를 충분히 밝게 유지한다.
4. 다크 테마는 표면 밝기(`surface`)를 낮춰 눈부심을 방지한다.
5. 상태 색상(`ok/warn/bad`)은 테마가 달라도 의미가 바뀌지 않아야 한다.

## Token Contract
- `--surface-1/2/3`: 기본 표면 계층
- `--input-bg`, `--input-border`: 입력계 컴포넌트
- `--button-bg`, `--button-hover`, `--ghost-bg`: 버튼 계열
- `--nav-text`, `--nav-active-*`: 내비게이션 계열
- `--chip-*`: 태그/뱃지 계열
- `--link`: 링크 컬러
- `--pixel-feed-*`: 픽셀 라이브 피드 계열

## Review Checklist (Per Release)
1. 라이트 모드에서 어두운 블록이 과도하게 시선을 빼앗지 않는가?
2. 다크 모드에서 흰색/밝은 면이 과도하게 남아 있지 않은가?
3. 폼 입력/버튼/태그/표가 테마 전환 시 동일한 의미 계층을 유지하는가?
4. `시스템` 모드에서 OS 테마 변경이 즉시 반영되는가?

## Ownership
- Design Ops Team Lead: 토큰 정책 승인/개정
- Frontend Lead: 구현 반영 및 회귀 방지
