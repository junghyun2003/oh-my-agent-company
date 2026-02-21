#!/usr/bin/env python3
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "state" / "agent_status.json"

STATUS_FLOW = {
    "healthy": ["healthy", "warning"],
    "warning": ["healthy", "warning", "critical"],
    "critical": ["warning", "critical"],
    "idle": ["idle", "healthy"],
}

BLOCKERS = [
    "Waiting for stakeholder input",
    "Dependency service timeout spike",
    "Pending schema migration approval",
    "CI pipeline flaky tests",
    "SLO burn-rate exceeded",
]

TASK_SUFFIX = [
    "validation",
    "handoff prep",
    "experiment review",
    "risk assessment",
    "delivery tracking",
]

WORK_TYPES = [
    "신규 제품 런칭",
    "기존 제품 개선",
    "엔터프라이즈 커스터마이징",
    "운영 안정화",
    "비용 최적화",
]

MISSIONS = [
    "SMB 대상 AI 고객지원 자동화 플랫폼 론칭",
    "글로벌 결제 전환율 8% 개선",
    "엔터프라이즈 고객 온보딩 리드타임 30% 단축",
    "모바일 이탈률 15% 감소",
    "클라우드 인프라 비용 20% 절감",
]

INITIATIVES = [
    "Launch readiness",
    "Conversion uplift",
    "Retention program",
    "Stability hardening",
    "Scale-out planning",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_state() -> dict:
    with STATE_FILE.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def save_state(state: dict) -> None:
    with STATE_FILE.open("w", encoding="utf-8") as fp:
        json.dump(state, fp, indent=2)
        fp.write("\n")


def mutate_agent(agent: dict) -> None:
    current = agent["status"]
    next_status = random.choice(STATUS_FLOW.get(current, ["healthy"]))
    agent["status"] = next_status

    base_latency = {
        "healthy": 180,
        "warning": 420,
        "critical": 700,
        "idle": 90,
    }[next_status]

    jitter = random.randint(-60, 120)
    agent["latency_ms"] = max(40, base_latency + jitter)

    base_error = {
        "healthy": 0.01,
        "warning": 0.05,
        "critical": 0.11,
        "idle": 0.0,
    }[next_status]

    agent["error_rate"] = round(max(0, base_error + random.uniform(-0.01, 0.02)), 3)
    agent["last_update"] = utc_now()

    if next_status in ("warning", "critical"):
        agent["blocker"] = random.choice(BLOCKERS)
    else:
        agent.pop("blocker", None)

    if random.random() < 0.3:
        stem = agent["current_task"].split(" - ")[0]
        agent["current_task"] = f"{stem} - {random.choice(TASK_SUFFIX)}"

    if random.random() < 0.25:
        agent["initiative"] = random.choice(INITIATIVES)


def recalc_summary(agents: list[dict]) -> dict:
    counts = {"healthy": 0, "warning": 0, "critical": 0}
    for item in agents:
        status = item.get("status")
        if status in counts:
            counts[status] += 1
    return {
        "total": len(agents),
        "healthy": counts["healthy"],
        "warning": counts["warning"],
        "critical": counts["critical"],
    }


def main() -> None:
    print(f"Updating {STATE_FILE} every 2 seconds. Press Ctrl+C to stop.")
    while True:
        state = load_state()
        agents = state["agents"]

        for agent in random.sample(agents, k=max(1, len(agents) // 3)):
            mutate_agent(agent)

        # Occasionally rotate company-level mission context.
        if random.random() < 0.2:
            state["work_type"] = random.choice(WORK_TYPES)
            state["company_mission"] = random.choice(MISSIONS)

        state["summary"] = recalc_summary(agents)
        state["updated_at"] = utc_now()
        save_state(state)
        time.sleep(2)


if __name__ == "__main__":
    main()
