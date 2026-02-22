#!/usr/bin/env python3
import argparse
import json
import random
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "state" / "agent_company.db"

ACTIVE_STATUSES = ("queued", "dispatching", "in_progress", "waiting_pre_approval", "waiting_post_approval")
PRIORITY_ORDER = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_ts(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def connect():
    con = sqlite3.connect(str(DB_PATH), timeout=30.0)
    con.row_factory = sqlite3.Row
    return con


def append_audit(cur, kind, at, detail, owner_id="local-owner", job_id=None, request_id=None, phase="ops", client=None):
    cur.execute(
        """
        INSERT INTO audit_events (at, kind, owner_id, job_id, request_id, repository, phase, client, detail)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (at, kind, owner_id, job_id, request_id, None, phase, client, json.dumps(detail, ensure_ascii=False)),
    )


def status_summary(cur):
    out = {}
    for row in cur.execute("SELECT status, COUNT(*) AS c FROM jobs GROUP BY status ORDER BY c DESC"):
        out[row["status"]] = int(row["c"])
    return out


def queue_snapshot(cur, limit=20):
    backlog = []
    for row in cur.execute(
        """
        SELECT id, request_id, priority, status, stage, created_at, started_at
        FROM jobs
        WHERE status IN ('queued','dispatching')
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 0
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
            ELSE 2
          END,
          created_at
        LIMIT ?
        """,
        (limit,),
    ):
        backlog.append(dict(row))

    in_progress = []
    for row in cur.execute(
        """
        SELECT id, request_id, priority, status, stage, created_at, started_at
        FROM jobs
        WHERE status='in_progress'
        ORDER BY started_at ASC, created_at ASC
        LIMIT ?
        """,
        (limit,),
    ):
        in_progress.append(dict(row))

    failed = []
    for row in cur.execute(
        """
        SELECT id, request_id, priority, status, stage, created_at, completed_at, error
        FROM jobs
        WHERE status='failed'
        ORDER BY completed_at DESC, created_at DESC
        LIMIT ?
        """,
        (limit,),
    ):
        failed.append(dict(row))

    return {"backlog": backlog, "in_progress": in_progress, "failed": failed}


def apply_rules(
    cur,
    now_dt,
    dry_run,
    queue_promote_min=15,
    queue_warn_min=30,
    progress_timeout_min=60,
    requeue_failed=False,
):
    now = utc_now()
    actions = {"promoted": [], "warned_queue": [], "recovered_in_progress": [], "requeued_failed": []}

    # 1) backlog priority promotion + warning
    for row in cur.execute("SELECT id, request_id, priority, created_at FROM jobs WHERE status IN ('queued','dispatching')"):
        created = parse_ts(row["created_at"])
        if not created:
            continue
        age_min = (now_dt - created).total_seconds() / 60
        if age_min >= queue_warn_min:
            info = {"id": row["id"], "request_id": row["request_id"], "age_min": round(age_min, 1)}
            actions["warned_queue"].append(info)
            if not dry_run:
                append_audit(cur, "queue_stalled_warning", now, {"age_min": round(age_min, 1)}, job_id=row["id"], request_id=row["request_id"])
        if age_min >= queue_promote_min and row["priority"] in ("normal", "low"):
            new_priority = "high" if age_min < 60 else "urgent"
            info = {"id": row["id"], "from": row["priority"], "to": new_priority, "age_min": round(age_min, 1)}
            actions["promoted"].append(info)
            if not dry_run:
                cur.execute("UPDATE jobs SET priority=? WHERE id=?", (new_priority, row["id"]))

    # 2) in_progress stalled recovery
    for row in cur.execute("SELECT id, request_id, timeline, started_at, created_at FROM jobs WHERE status='in_progress'"):
        base = parse_ts(row["started_at"]) or parse_ts(row["created_at"])
        if not base:
            continue
        age_min = (now_dt - base).total_seconds() / 60
        if age_min < progress_timeout_min:
            continue
        info = {"id": row["id"], "request_id": row["request_id"], "age_min": round(age_min, 1)}
        actions["recovered_in_progress"].append(info)
        if dry_run:
            continue
        timeline = []
        try:
            timeline = json.loads(row["timeline"]) if row["timeline"] else []
        except Exception:
            timeline = []
        timeline.append({"at": now, "message": "Stalled job auto-closed by ops queue manager."})
        cur.execute(
            "UPDATE jobs SET status='failed', stage='failed', completed_at=?, error=?, timeline=? WHERE id=?",
            (now, "stalled_timeout_recovery", json.dumps(timeline, ensure_ascii=False), row["id"]),
        )
        cur.execute("UPDATE requests SET status='received' WHERE id=?", (row["request_id"],))
        append_audit(
            cur,
            "job_stalled_recovered",
            now,
            {"reason": "stalled_timeout_recovery", "source": "ops_queue_manager"},
            job_id=row["id"],
            request_id=row["request_id"],
        )

    # 3) failed requeue (optional)
    if requeue_failed:
        qmarks = ",".join(["?"] * len(ACTIVE_STATUSES))
        for row in cur.execute("SELECT * FROM jobs WHERE status='failed' ORDER BY completed_at DESC, created_at DESC"):
            request_id = row["request_id"]
            active = cur.execute(
                f"SELECT id FROM jobs WHERE request_id=? AND status IN ({qmarks}) LIMIT 1",
                (request_id, *ACTIVE_STATUSES),
            ).fetchone()
            if active:
                continue
            req = cur.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
            if not req:
                continue
            if req["status"] in ("completed", "responded"):
                continue
            new_id = f"job-{int(time.time())}-{random.randint(100,999)}"
            priority = row["priority"] if row["priority"] in PRIORITY_ORDER else "high"
            if priority in ("low", "normal"):
                priority = "high"
            info = {"from": row["id"], "to": new_id, "request_id": request_id}
            actions["requeued_failed"].append(info)
            if dry_run:
                continue
            cur.execute(
                """
                INSERT INTO jobs (
                  id, owner_id, request_id, client_name, work_type, mission, repository, refined_request,
                  apply_changes, approval_mode, priority, status, stage, created_at,
                  dispatched_at, started_at, completed_at, report_path,
                  pre_approved, pre_approved_at, post_approved, post_approved_at,
                  error, executed_actions, changed_files, pm_notes, cto_notes, dev_notes, qa_notes, timeline
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    new_id,
                    row["owner_id"],
                    row["request_id"],
                    row["client_name"],
                    row["work_type"],
                    row["mission"],
                    row["repository"],
                    (row["refined_request"] or "") + "\n[ops] failed job auto-requeued by queue manager",
                    int(row["apply_changes"] or 0),
                    row["approval_mode"] or "auto",
                    priority,
                    "queued",
                    "queued",
                    now,
                    None,
                    None,
                    None,
                    None,
                    0,
                    None,
                    0,
                    None,
                    None,
                    "[]",
                    "[]",
                    "[]",
                    "[]",
                    "[]",
                    "[]",
                    json.dumps([{"at": now, "message": "Auto requeued from failed backlog by ops queue manager"}], ensure_ascii=False),
                ),
            )
            cur.execute("UPDATE requests SET status='in_company', linked_job_id=?, assigned_at=? WHERE id=?", (new_id, now, request_id))
            append_audit(cur, "job_requeued_from_failed", now, {"source_failed_job": row["id"]}, job_id=new_id, request_id=request_id)

    return actions


def cmd_summary(args):
    con = connect()
    cur = con.cursor()
    out = {"status_summary": status_summary(cur), "snapshot": queue_snapshot(cur, limit=args.limit)}
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_apply(args):
    con = connect()
    cur = con.cursor()
    now_dt = datetime.now(timezone.utc)
    actions = apply_rules(
        cur,
        now_dt=now_dt,
        dry_run=args.dry_run,
        queue_promote_min=args.queue_promote_min,
        queue_warn_min=args.queue_warn_min,
        progress_timeout_min=args.progress_timeout_min,
        requeue_failed=args.requeue_failed,
    )
    out = {"dry_run": bool(args.dry_run), "actions": actions, "status_summary": status_summary(cur)}
    if not args.dry_run:
        append_audit(cur, "ops_queue_managed", utc_now(), out)
        con.commit()
    print(json.dumps(out, ensure_ascii=False, indent=2))


def build_parser():
    p = argparse.ArgumentParser(description="Manage backlog / in_progress / failed jobs for local agent company.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("summary", help="Show queue snapshot and status counts.")
    s.add_argument("--limit", type=int, default=20)
    s.set_defaults(func=cmd_summary)

    a = sub.add_parser("apply", help="Apply queue management rules.")
    a.add_argument("--dry-run", action="store_true")
    a.add_argument("--queue-promote-min", type=int, default=15)
    a.add_argument("--queue-warn-min", type=int, default=30)
    a.add_argument("--progress-timeout-min", type=int, default=60)
    a.add_argument("--requeue-failed", action="store_true")
    a.set_defaults(func=cmd_apply)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

