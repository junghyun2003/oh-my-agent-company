# Commit / Push Rules (Team Standard)

## Why This Rule
- 히스토리 가독성, 릴리즈 자동화, 협업 속도, 롤백 안정성을 높이기 위함

## Selected Baseline (Widely Adopted)
1. Commit message format: **Conventional Commits**
2. Collaboration flow: **GitHub Flow** (짧은 브랜치 + 빠른 PR/머지)

## Commit Message Template
```text
<type>(<scope>): <summary>

[optional body]

[optional footer]
```

## Team Scope Standard (Required)
팀별 로그 분리를 위해 `scope`는 아래 팀 코드만 사용한다.

- `ceo`: Executive CEO
- `cto`: Executive CTO
- `pm`: Project Manager
- `product`: Product Planning
- `backend`: Engineering Backend
- `frontend`: Engineering Frontend
- `app`: Engineering App
- `design`: Design Ops
- `security`: Security Ops
- `qa`: Quality Assurance
- `infra`: Infrastructure
- `marketing`: Marketing
- `strategy`: Business Strategy
- `tech-lead`: Technology Lead

예시:
- `feat(frontend): 승인 화면 그리드 레이아웃 안정화`
- `fix(infra): 포트 충돌 자동 복구 로직 보강`
- `docs(product): 요청 우선순위 필드 정의 갱신`

## Allowed Types
- `feat`: 사용자 가치 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변화 없는 구조 개선
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정/운영 잡무
- `ci`: CI/CD 파이프라인 변경
- `perf`: 성능 개선

## Required Rules
1. 한 커밋은 한 가지 의도만 담는다.
2. 커밋 제목은 72자 내외로 간결히 작성한다.
3. 파괴적 변경은 `!` 또는 `BREAKING CHANGE:`로 명시한다.
4. 모든 작업은 로컬에만 두지 말고 완료 단위마다 원격에 푸시한다.
5. 팀 관련 변경은 반드시 `type(<team-scope>): ...` 형식으로 작성한다.
6. 다중 팀 변경은 커밋을 분리한다. (예: `frontend`와 `design` 분리)

## Push Cadence
1. 화면/기능 단위 완료 시 즉시 `commit + push`
2. 핫픽스는 수정 후 즉시 `commit + push`
3. 장시간(예: 30분+) 로컬 단독 작업 금지
4. 사용자 보고 전에 `git status`가 깨끗한지 확인

## Recommended Local Commands
```bash
git status -sb
git add -A
git commit -m "fix(frontend): short summary"
git push
```

## Team Log View (Korean)
팀별 커밋 로그 확인:

```bash
./scripts/team_commit_log.sh frontend
./scripts/team_commit_log.sh infra 50
./scripts/team_commit_log.sh all 100
```

## References
- Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/
- GitHub Flow (GitHub Docs): https://docs.github.com/en/get-started/using-github/github-flow
- Branch protection (GitHub Docs): https://docs.github.com/articles/about-required-reviews-for-pull-requests
