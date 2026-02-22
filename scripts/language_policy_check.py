#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "dashboard" / "index.html"
POLICY = ROOT / "teams" / "design-ops" / "LANGUAGE_POLICY.md"

REQUIRED_LABELS = [
    "운영 설정",
    "요청 접수",
    "작업 할당",
    "감사 로그",
    "실행 상태",
]


def main() -> int:
    problems = []
    if not POLICY.exists():
        problems.append(f"missing_policy:{POLICY}")
    if not DASHBOARD.exists():
        problems.append(f"missing_dashboard:{DASHBOARD}")
        print("LANGUAGE_POLICY_CHECK=FAIL")
        for p in problems:
            print(p)
        return 1

    text = DASHBOARD.read_text(encoding="utf-8")
    for label in REQUIRED_LABELS:
        if label not in text:
            problems.append(f"missing_korean_label:{label}")

    # Sanity: core nav buttons should include Hangul characters.
    nav_area = re.findall(r'<button[^>]*class="nav-item"[^>]*>(.*?)</button>', text)
    for idx, raw in enumerate(nav_area, start=1):
        plain = re.sub(r"<[^>]+>", "", raw)
        if not re.search(r"[가-힣]", plain):
            problems.append(f"nav_not_korean_first:{idx}:{plain.strip()}")

    if problems:
        print("LANGUAGE_POLICY_CHECK=FAIL")
        for p in problems:
            print(p)
        return 1

    print("LANGUAGE_POLICY_CHECK=OK")
    print(f"checked_policy={POLICY}")
    print(f"checked_dashboard={DASHBOARD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
