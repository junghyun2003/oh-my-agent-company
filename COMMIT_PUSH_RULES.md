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

## Push Cadence
1. 화면/기능 단위 완료 시 즉시 `commit + push`
2. 핫픽스는 수정 후 즉시 `commit + push`
3. 장시간(예: 30분+) 로컬 단독 작업 금지
4. 사용자 보고 전에 `git status`가 깨끗한지 확인

## Recommended Local Commands
```bash
git status -sb
git add -A
git commit -m "fix(scope): short summary"
git push
```

## References
- Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/
- GitHub Flow (GitHub Docs): https://docs.github.com/en/get-started/using-github/github-flow
- Branch protection (GitHub Docs): https://docs.github.com/articles/about-required-reviews-for-pull-requests
