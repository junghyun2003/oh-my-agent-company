# Fork Customization Policy

이 문서는 `oh-my-agent-company`를 포크해 커스텀하는 사용자가
원본(Upstream)과 커스텀(Custom) 변경을 명확히 분리하기 위한 운영 규칙이다.

## 목적
- 원본 대비 변경사항을 빠르게 식별
- 업스트림 동기화 충돌 최소화
- 클라이언트/기여자에게 변경 책임 범위를 투명하게 공개

## 필수 규칙
1. 포크 저장소는 업스트림 기준선을 반드시 기록한다.
2. 커스텀 변경은 `CUSTOMIZATION_LOG.md`에 누적 기록한다.
3. 커밋 메시지는 팀 scope와 함께 Change-Origin 푸터를 남긴다.
4. 릴리즈 전 `scripts/fork_diff_report.sh`로 원본 대비 차이를 검증한다.

## Upstream Baseline 관리
- 파일: `UPSTREAM_BASELINE.env`
- 관리 항목:
  - `UPSTREAM_REMOTE`
  - `UPSTREAM_BRANCH`
  - `UPSTREAM_REF`
  - `LAST_SYNC_AT`

`UPSTREAM_REF`는 일반적으로 태그 또는 커밋 SHA를 사용한다.

## Commit Footer Standard
기본 형식:

```text
<type>(<team-scope>): <summary>

Change-Origin: upstream|custom
Upstream-Ref: <tag-or-sha-or-none>
```

예시:

```text
feat(frontend): 상태판 카드 대비 개선

Change-Origin: custom
Upstream-Ref: v0.3.0
```

## 운영 리포트
- 커맨드: `./scripts/fork_diff_report.sh`
- 출력:
  - 현재 baseline 정보
  - baseline 대비 커밋 목록
  - baseline 대비 변경 파일 통계

## 권장 브랜치 전략
- 업스트림 동기화: `sync/upstream-main`
- 커스텀 개발: `custom/*`
- 배포 기준: `main` (또는 조직 표준 브랜치)

