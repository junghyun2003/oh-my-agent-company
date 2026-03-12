#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import scripts.orchestrator_server as oc


def run(args, cwd=None):
    subprocess.run(args, cwd=str(cwd) if cwd else None, check=True, text=True, capture_output=True)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def build_fake_gh(path, state_file):
    script = f"""#!/usr/bin/env python3
import json
import sys
from pathlib import Path

state_path = Path({json.dumps(str(state_file))})
state = {{}}
if state_path.exists():
    state = json.loads(state_path.read_text(encoding="utf-8"))

args = sys.argv[1:]
if args[:2] == ["auth", "status"]:
    print("github.com")
    raise SystemExit(0)

if args[:2] == ["pr", "list"]:
    pr = state.get("pr")
    print(json.dumps([pr] if pr else []))
    raise SystemExit(0)

if args[:2] == ["pr", "create"]:
    title = ""
    base = ""
    head = ""
    body = ""
    for idx, token in enumerate(args):
        if token == "--title":
            title = args[idx + 1]
        if token == "--base":
            base = args[idx + 1]
        if token == "--head":
            head = args[idx + 1]
        if token == "--body":
            body = args[idx + 1]
    pr = {{
        "number": 1,
        "url": "https://example.test/pr/1",
        "state": "OPEN",
        "title": title,
        "baseRefName": base,
        "headRefName": head,
        "body": body,
    }}
    state["pr"] = pr
    state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    print(pr["url"])
    raise SystemExit(0)

print(f"unsupported gh args: {{args}}", file=sys.stderr)
raise SystemExit(1)
"""
    write(path, script)
    path.chmod(0o755)


def insert_job(repo_path):
    request_id = "req-smoke-001"
    job_id = "job-smoke-001"
    now = oc.utc_now()
    repo_value = str(Path(repo_path).resolve())
    oc.exec_sql(
        "INSERT INTO requests (id, owner_id, client_name, raw_request, status, created_at) VALUES (?,?,?,?,?,?)",
        (request_id, "local-owner", "smoke-client", "repo delivery smoke", "received", now),
    )
    oc.exec_sql(
        """
        INSERT INTO jobs (
          id, owner_id, request_id, client_name, work_type, mission, repository, refined_request,
          apply_changes, approval_mode, priority, status, stage, created_at, timeline
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            job_id,
            "local-owner",
            request_id,
            "smoke-client",
            "smoke",
            "validate branch and pull request delivery",
            repo_value,
            "[요약] dashboard menu branch delivery\n1. 메뉴 개선\n2. 브랜치 생성\n3. PR 생성",
            1,
            "auto",
            "normal",
            "queued",
            "queued",
            now,
            oc.jdump([{"at": now, "message": "Smoke test job queued"}]),
        ),
    )
    return request_id, job_id


def main():
    with tempfile.TemporaryDirectory(prefix="repo-delivery-smoke-") as tmp:
        tmp_path = Path(tmp)
        remote = tmp_path / "remote.git"
        repo = tmp_path / "repo"
        db_path = tmp_path / "agent_company.db"
        deliverables = tmp_path / "deliverables"
        fake_gh_state = tmp_path / "gh-state.json"
        fake_gh = tmp_path / "bin" / "gh"

        run(["git", "init", "--bare", str(remote)])
        run(["git", "init", "-b", "main", str(repo)])
        run(["git", "config", "user.name", "Smoke Tester"], cwd=repo)
        run(["git", "config", "user.email", "smoke@example.com"], cwd=repo)
        write(repo / "dashboard" / "index.html", "<body><main>dashboard</main></body>\n")
        write(repo / "dashboard" / "styles.css", "body { color: #111; }\n")
        run(["git", "add", "."], cwd=repo)
        run(["git", "commit", "-m", "chore: seed repo"], cwd=repo)
        run(["git", "remote", "add", "origin", str(remote)], cwd=repo)
        run(["git", "push", "-u", "origin", "main"], cwd=repo)
        run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], cwd=repo)

        build_fake_gh(fake_gh, fake_gh_state)

        oc.DB_PATH = db_path
        oc.DELIVERABLE_DIR = deliverables
        oc.DB = oc.db_connect()
        oc.init_db()
        oc.seed_defaults()
        oc.set_app_setting("execution_mode", "template")
        oc.set_app_setting("gh_bin", str(fake_gh))
        oc.exec_sql(
            "INSERT INTO repo_policies (path, enabled, allowed_actions, writable_paths, require_pre_approval, require_post_approval) VALUES (?,?,?,?,?,?)",
            (
                str(repo.resolve()),
                1,
                oc.jdump(["dashboard_snb", "work_intake_menu", "audit_log_readability"]),
                oc.jdump([str((repo / "dashboard").resolve())]),
                0,
                0,
            ),
        )

        request_id, job_id = insert_job(repo)
        job = dict(oc.q1("SELECT * FROM jobs WHERE id=?", (job_id,)))

        original_is_github_remote = oc.is_github_remote
        oc.is_github_remote = lambda remote_url: True
        try:
            oc.run_pipeline(job)
        finally:
            oc.is_github_remote = original_is_github_remote

        job_row = dict(oc.q1("SELECT * FROM jobs WHERE id=?", (job_id,)))
        delivery = oc.normalize_repo_delivery(job_row.get("repo_delivery"))
        assert job_row["status"] == "done", job_row
        assert delivery.get("working_branch", "").startswith("codex/"), delivery
        assert delivery.get("commit_sha"), delivery
        assert delivery.get("pr_status") in {"created", "existing"}, delivery
        assert delivery.get("pr_url") == "https://example.test/pr/1", delivery

        branch_name = delivery["working_branch"]
        local_branch = subprocess.run(["git", "branch", "--show-current"], cwd=str(repo), text=True, capture_output=True, check=True).stdout.strip()
        assert local_branch == branch_name, {"expected": branch_name, "actual": local_branch}
        remote_branch = subprocess.run(["git", "ls-remote", "--heads", "origin", branch_name], cwd=str(repo), text=True, capture_output=True, check=True).stdout.strip()
        assert remote_branch, branch_name

        report_path = Path(deliverables / f"job-{job_id}.md")
        report_text = report_path.read_text(encoding="utf-8")
        assert "## Repository Delivery" in report_text, report_text
        assert "https://example.test/pr/1" in report_text, report_text

        request_row = dict(oc.q1("SELECT * FROM requests WHERE id=?", (request_id,)))
        assert request_row["status"] == "completed", request_row
        assert "Pull Request" in (request_row.get("response_note") or ""), request_row

        audit_rows = [dict(row) for row in oc.q("SELECT kind FROM audit_events WHERE job_id=? ORDER BY id", (job_id,))]
        kinds = {row["kind"] for row in audit_rows}
        required = {"job_branch_prepared", "job_commit_created", "job_branch_pushed", "pull_request_created", "job_done", "post_job_audit"}
        missing = required - kinds
        assert not missing, {"missing_audit_kinds": sorted(missing), "seen": sorted(kinds)}

        print("repo_delivery_smoke=ok")
        print(f"job_id={job_id}")
        print(f"branch={branch_name}")
        print(f"pr_url={delivery.get('pr_url')}")


if __name__ == "__main__":
    main()
