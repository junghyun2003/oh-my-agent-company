#!/usr/bin/env python3
import argparse
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "state" / "agent_company.db"


def parse_utc(value: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def utc_now():
    return datetime.now(timezone.utc)


def in_window(ts: str, since: datetime):
    dt = parse_utc(ts)
    return bool(dt and dt >= since)


def run(days: int):
    since = utc_now() - timedelta(days=days)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    requests = [dict(r) for r in cur.execute("SELECT id, created_at FROM requests")]
    jobs = [dict(r) for r in cur.execute("SELECT id, status, created_at, completed_at FROM jobs")]
    events = [dict(r) for r in cur.execute("SELECT at, kind FROM audit_events")]

    req_in = [r for r in requests if in_window(r.get("created_at"), since)]
    jobs_in = [j for j in jobs if in_window(j.get("created_at"), since)]
    done_in = [j for j in jobs_in if j.get("status") == "done"]
    fail_in = [j for j in jobs_in if j.get("status") == "failed"]

    lead_samples = []
    for job in done_in:
        c_at = parse_utc(job.get("created_at"))
        d_at = parse_utc(job.get("completed_at"))
        if c_at and d_at and d_at >= c_at:
            lead_samples.append((d_at - c_at).total_seconds() / 60.0)

    avg_lead_min = round(sum(lead_samples) / len(lead_samples), 1) if lead_samples else 0.0
    success_rate = round((len(done_in) / len(jobs_in) * 100.0), 1) if jobs_in else 0.0

    event_counts = {}
    for e in events:
        if not in_window(e.get("at"), since):
            continue
        k = str(e.get("kind") or "unknown")
        event_counts[k] = event_counts.get(k, 0) + 1

    top_events = sorted(event_counts.items(), key=lambda x: (-x[1], x[0]))[:8]

    report = {
        "window": {
            "days": days,
            "since": since.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "generated_at": utc_now().replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "kpi": {
            "requests_received": len(req_in),
            "jobs_created": len(jobs_in),
            "jobs_done": len(done_in),
            "jobs_failed": len(fail_in),
            "success_rate_pct": success_rate,
            "avg_lead_time_min": avg_lead_min,
        },
        "top_audit_events": [{"kind": k, "count": v} for k, v in top_events],
    }
    return report


def main():
    p = argparse.ArgumentParser(description="Generate weekly KPI report from local agent company DB")
    p.add_argument("--days", type=int, default=7)
    p.add_argument("--output", default="")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    report = run(max(1, args.days))
    text = json.dumps(report, ensure_ascii=False, indent=2)

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n", encoding="utf-8")
        print(f"saved_report={out}")

    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
