#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "company_agents": ROOT / "AGENTS.md",
    "team_index": ROOT / "teams" / "AGENTS.md",
    "readme": ROOT / "README.md",
}

REQUIRED_TOKENS = {
    "company_agents": [
        "Source Of Truth",
        "Queue Governance Policy",
        "Mandatory Enforcement",
    ],
    "team_index": [
        "Universal Output Contract",
        "Universal Control Rules",
        "Handoff Gate",
    ],
    "readme": [
        "Quick Start (Sequential)",
        "Queue management API",
        "Team and Governance Docs",
    ],
}

CROSS_RULES = {
    "approval": ["승인", "approval"],
    "audit": ["감사", "audit"],
    "queue": ["queue", "큐"],
    "design": ["Design", "디자인"],
}


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return path.read_text(encoding="utf-8")


def main() -> int:
    problems = []
    docs = {}
    for key, path in FILES.items():
        try:
            docs[key] = read_text(path)
        except Exception as exc:
            problems.append(f"missing_or_unreadable:{key}:{exc}")

    for key, tokens in REQUIRED_TOKENS.items():
        text = docs.get(key, "")
        for token in tokens:
            if token not in text:
                problems.append(f"missing_token:{key}:{token}")

    for label, variants in CROSS_RULES.items():
        missing = [
            name
            for name, text in docs.items()
            if not any(v.lower() in text.lower() for v in variants)
        ]
        if missing:
            problems.append(f"cross_missing:{label}:{','.join(missing)}")

    if problems:
        print("DOC_SYNC_CHECK=FAIL")
        for line in problems:
            print(line)
        return 1

    print("DOC_SYNC_CHECK=OK")
    for name, path in FILES.items():
        print(f"checked:{name}:{path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
