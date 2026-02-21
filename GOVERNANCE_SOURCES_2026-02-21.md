# Governance Evidence Pack (2026-02-21)

본 문서는 oh-my-agent-company의 운영 정책 강화에 사용한 공개/검증 가능한 참고 자료를 기록한다.

## Verified Sources
1. Scrum Guide (Scrum events / inspection-adaptation)
- https://scrumguides.org/scrum-guide-2017.html
- 핵심 적용: 정기 계획-점검-회고 사이클(Planning/Review/Retrospective) 기반의 리더 토의 구조

2. DORA Metrics (delivery throughput + instability)
- https://dora.dev/guides/dora-metrics-four-keys/
- https://dora.dev/guides/dora-metrics/history
- 핵심 적용: 배포 빈도/리드타임/복구시간/실패율 기반 운영 성과 추적

3. NIST Incident Handling Guide
- https://www.nist.gov/publications/computer-security-incident-handling-guide
- 핵심 적용: 준비-탐지-대응-복구-교훈(lessons learned) 루프를 정책에 강제

4. CISA Stakeholder Engagement Strategic Plan
- https://www.cisa.gov/resources-tools/resources/stakeholder-engagement-strategic-plan
- 핵심 적용: 이해관계자 협업/정보공유/피드백 기반 운영 원칙

5. GitHub Projects Docs (table/board/roadmap/custom fields/workflows)
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project
- https://docs.github.com/en/enterprise-cloud%40latest/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
- 핵심 적용: 클라이언트/내부가 한눈에 보는 상태판(칸반+타임라인+자동 상태 전이)

## Policy Mapping
- 리더 토의 구조 강화: Scrum 이벤트 기반 운영 리듬을 CEO/CTO/팀장 회의체에 적용
- 팀원 지시 투명성 강화: 작업 지시 카드(목표/범위/수용기준/의존성/리스크/ETA/담당) 필수
- 클라이언트 가시성 강화: 요청별 단일 상태판 + 단계/담당/차단요인/다음 업데이트 시각 표시
- 재발 방지 강화: NIST 기반 사후 회고를 감사로그와 정책 문서에 의무 반영
