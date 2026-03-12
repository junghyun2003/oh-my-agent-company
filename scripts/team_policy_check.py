#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEAM_INDEX = ROOT / "teams" / "AGENTS.md"
TEAM_MATRIX = ROOT / "docs" / "TEAM_ROLE_MATRIX.md"

COMMON_HEADINGS = [
    "## Mission",
    "## Pipeline Responsibility",
    "## Inputs",
    "## Outputs",
    "## Success Metrics",
    "## Decision Rights",
    "## Handoff and Gate",
    "## Audit Fields You Must Leave",
    "## Local Operation Rules",
]

TEAM_RULES = {
    "executive-ceo": {
        "path": ROOT / "teams" / "executive-ceo" / "AGENTS.md",
        "keywords": ["Report", "post_job_audit", "다음 업데이트 시각"],
        "team_name": "CEO",
    },
    "executive-cto": {
        "path": ROOT / "teams" / "executive-cto" / "AGENTS.md",
        "keywords": ["CTO", "A/B", "롤백"],
        "team_name": "CTO",
    },
    "business-strategy": {
        "path": ROOT / "teams" / "business-strategy" / "AGENTS.md",
        "keywords": ["ROI", "KPI", "우선순위"],
        "team_name": "Business Strategy",
        "requires_team_lead": True,
    },
    "marketing": {
        "path": ROOT / "teams" / "marketing" / "AGENTS.md",
        "keywords": ["한 줄 가치제안", "3개 핵심 강점", "4블록"],
        "team_name": "Marketing",
        "requires_team_lead": True,
    },
    "product-planning": {
        "path": ROOT / "teams" / "product-planning" / "AGENTS.md",
        "keywords": ["raw_request", "refined_request", "수용 기준"],
        "team_name": "Product Planning",
        "requires_team_lead": True,
    },
    "project-manager": {
        "path": ROOT / "teams" / "project-manager" / "AGENTS.md",
        "keywords": ["PM", "긴급", "의존성"],
        "team_name": "Project Manager",
        "requires_team_lead": True,
    },
    "engineering-backend": {
        "path": ROOT / "teams" / "engineering-backend" / "AGENTS.md",
        "keywords": ["상태 전이", "문서", "테스트"],
        "team_name": "Engineering Backend",
        "requires_team_lead": True,
    },
    "engineering-frontend": {
        "path": ROOT / "teams" / "engineering-frontend" / "AGENTS.md",
        "keywords": ["Design Ops", "공통 컴포넌트", "디자인 토큰"],
        "team_name": "Engineering Frontend",
        "requires_team_lead": True,
    },
    "engineering-app": {
        "path": ROOT / "teams" / "engineering-app" / "AGENTS.md",
        "keywords": ["모바일", "API 응답 계약", "후속 작업"],
        "team_name": "Engineering App",
        "requires_team_lead": True,
    },
    "design-ops": {
        "path": ROOT / "teams" / "design-ops" / "AGENTS.md",
        "keywords": ["Design Review", "pass/block/waive", "SLA"],
        "team_name": "Design Ops",
        "requires_team_lead": True,
    },
    "security-ops": {
        "path": ROOT / "teams" / "security-ops" / "AGENTS.md",
        "keywords": ["민감정보", "high", "완화 조치"],
        "team_name": "Security Ops",
        "requires_team_lead": True,
    },
    "quality-assurance": {
        "path": ROOT / "teams" / "quality-assurance" / "AGENTS.md",
        "keywords": ["playwright_ops_e2e.sh", "codex_runtime_canary.sh", "post_job_audit"],
        "team_name": "Quality Assurance",
        "requires_team_lead": True,
    },
    "infrastructure": {
        "path": ROOT / "teams" / "infrastructure" / "AGENTS.md",
        "keywords": ["Codex Preflight", "process + port + api", "infra_server_ctl.sh"],
        "team_name": "Infrastructure",
        "requires_team_lead": True,
    },
    "technology-lead": {
        "path": ROOT / "teams" / "technology-lead" / "AGENTS.md",
        "keywords": ["정책-코드-검증", "기술 트렌드", "릴리즈 보류"],
        "team_name": "Technology Lead",
    },
}

SECTION_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def get_section_body(text: str, heading: str) -> str:
    escaped = re.escape(heading)
    pattern = re.compile(rf"^{escaped}\n(.*?)(?=^##\s+|\Z)", re.MULTILINE | re.DOTALL)
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def main() -> int:
    problems: list[str] = []
    checked: list[str] = []

    try:
        team_index_text = read_text(TEAM_INDEX)
        checked.append(str(TEAM_INDEX))
    except Exception as exc:
        print("TEAM_POLICY_CHECK=FAIL")
        print(f"missing_or_unreadable:team_index:{exc}")
        return 1

    try:
        matrix_text = read_text(TEAM_MATRIX)
        checked.append(str(TEAM_MATRIX))
    except Exception as exc:
        print("TEAM_POLICY_CHECK=FAIL")
        print(f"missing_or_unreadable:team_matrix:{exc}")
        return 1

    for required in ["## Team File Standard", "docs/TEAM_ROLE_MATRIX.md"]:
        if required not in team_index_text:
            problems.append(f"missing_token:team_index:{required}")

    for token in [
        "| Team | Primary Stage | Position Fit | Critical Metric | Mandatory Gate | Primary Handoff |",
        "CEO",
        "CTO",
        "Business Strategy",
        "Marketing",
        "Product Planning",
        "Project Manager",
        "Engineering Backend",
        "Engineering Frontend",
        "Engineering App",
        "Design Ops",
        "Security Ops",
        "Quality Assurance",
        "Infrastructure",
        "Technology Lead",
    ]:
        if token not in matrix_text:
            problems.append(f"missing_token:team_matrix:{token}")

    for slug, rule in TEAM_RULES.items():
        path = rule["path"]
        try:
            text = read_text(path)
            checked.append(str(path))
        except Exception as exc:
            problems.append(f"missing_or_unreadable:{slug}:{exc}")
            continue

        rel_path = path.relative_to(ROOT).as_posix()
        if rel_path not in team_index_text:
            problems.append(f"missing_path:team_index:{rel_path}")

        for heading in COMMON_HEADINGS:
            if heading not in text:
                problems.append(f"missing_heading:{slug}:{heading}")
                continue
            body = get_section_body(text, heading)
            if not body:
                problems.append(f"empty_section:{slug}:{heading}")
            if heading in {"## Success Metrics", "## Handoff and Gate"} and "- " not in body:
                problems.append(f"missing_bullets:{slug}:{heading}")

        if rule.get("requires_team_lead") and "## Team Lead Role" not in text:
            problems.append(f"missing_heading:{slug}:## Team Lead Role")

        for keyword in rule["keywords"]:
            if keyword not in text:
                problems.append(f"missing_keyword:{slug}:{keyword}")

    if problems:
        print("TEAM_POLICY_CHECK=FAIL")
        for line in problems:
            print(line)
        return 1

    print("TEAM_POLICY_CHECK=OK")
    for path in checked:
        print(f"checked:{path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
