#!/usr/bin/env python3
import json
import os
import random
import sqlite3
import subprocess
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "state" / "agent_company.db"
DELIVERABLE_DIR = ROOT / "deliverables"
PORT = int(os.environ.get("ORCHESTRATOR_PORT", "18765"))
LOCK = threading.Lock()
DB = None
DEFAULT_CODEX_MODELS = ["gpt-5-codex", "gpt-5", "o4-mini", "o3"]
DB_RETRY_ATTEMPTS = 5
DB_RETRY_SLEEP_SEC = 0.15


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_json(value, default):
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def jdump(value):
    return json.dumps(value, ensure_ascii=False)


def display_path(value):
    if value in (None, ""):
        return ""
    try:
        resolved = Path(value).resolve()
        rel = resolved.relative_to(ROOT.resolve())
        return f"./{rel.as_posix()}"
    except Exception:
        return str(value)


def display_paths(values):
    return [display_path(v) for v in (values or [])]


def db_connect():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=7000")
    return conn


def _is_retryable_db_error(exc):
    msg = str(exc).lower()
    return "database is locked" in msg or "database is busy" in msg or "locked" in msg


def _db_fetchall(sql, params=()):
    last_exc = None
    for _ in range(DB_RETRY_ATTEMPTS):
        try:
            cur = DB.execute(sql, params)
            return cur.fetchall()
        except sqlite3.OperationalError as exc:
            last_exc = exc
            if not _is_retryable_db_error(exc):
                raise
            time.sleep(DB_RETRY_SLEEP_SEC)
    raise last_exc


def _db_fetchone(sql, params=()):
    last_exc = None
    for _ in range(DB_RETRY_ATTEMPTS):
        try:
            return DB.execute(sql, params).fetchone()
        except sqlite3.OperationalError as exc:
            last_exc = exc
            if not _is_retryable_db_error(exc):
                raise
            time.sleep(DB_RETRY_SLEEP_SEC)
    raise last_exc


def _db_exec(sql, params=()):
    last_exc = None
    for _ in range(DB_RETRY_ATTEMPTS):
        try:
            DB.execute(sql, params)
            DB.commit()
            return
        except sqlite3.OperationalError as exc:
            last_exc = exc
            if not _is_retryable_db_error(exc):
                raise
            time.sleep(DB_RETRY_SLEEP_SEC)
    raise last_exc


def q(sql, params=()):
    return _db_fetchall(sql, params)


def q1(sql, params=()):
    return _db_fetchone(sql, params)


def exec_sql(sql, params=()):
    _db_exec(sql, params)


def init_db():
    DB.executescript(
        """
        CREATE TABLE IF NOT EXISTS owner_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          owner_mode_enabled INTEGER NOT NULL,
          owner_id TEXT NOT NULL,
          owner_token_required INTEGER NOT NULL,
          owner_token TEXT NOT NULL,
          role TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS repo_policies (
          path TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL,
          allowed_actions TEXT NOT NULL,
          writable_paths TEXT NOT NULL,
          require_pre_approval INTEGER NOT NULL,
          require_post_approval INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS usage_stats (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          started_at TEXT NOT NULL,
          api_calls_total INTEGER NOT NULL,
          last_api_at TEXT,
          last_api_method TEXT,
          last_api_path TEXT
        );

        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          client_name TEXT NOT NULL,
          raw_request TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          linked_job_id TEXT,
          assigned_at TEXT,
          completed_at TEXT,
          response_note TEXT,
          responded_at TEXT
        );

        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          client_name TEXT NOT NULL,
          work_type TEXT NOT NULL,
          mission TEXT NOT NULL,
          repository TEXT NOT NULL,
          refined_request TEXT NOT NULL,
          apply_changes INTEGER NOT NULL,
          approval_mode TEXT NOT NULL,
          status TEXT NOT NULL,
          stage TEXT NOT NULL,
          created_at TEXT NOT NULL,
          dispatched_at TEXT,
          started_at TEXT,
          completed_at TEXT,
          report_path TEXT,
          pre_approved INTEGER DEFAULT 0,
          pre_approved_at TEXT,
          post_approved INTEGER DEFAULT 0,
          post_approved_at TEXT,
          error TEXT,
          executed_actions TEXT,
          changed_files TEXT,
          pm_notes TEXT,
          cto_notes TEXT,
          dev_notes TEXT,
          qa_notes TEXT,
          timeline TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_status (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          team TEXT NOT NULL,
          status TEXT NOT NULL,
          current_task TEXT NOT NULL,
          initiative TEXT,
          owner TEXT,
          last_update TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          error_rate REAL NOT NULL,
          next_handoff TEXT,
          blocker TEXT
        );

        CREATE TABLE IF NOT EXISTS state_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          kind TEXT,
          owner_id TEXT,
          job_id TEXT,
          request_id TEXT,
          repository TEXT,
          phase TEXT,
          client TEXT,
          detail TEXT
        );
        """
    )
    DB.commit()


def seed_defaults():
    default_actions = ["dashboard_snb", "work_intake_menu", "audit_log_readability"]
    default_writable = [str((ROOT / "dashboard").resolve())]

    if not q1("SELECT id FROM owner_config WHERE id = 1"):
        exec_sql(
            "INSERT INTO owner_config (id, owner_mode_enabled, owner_id, owner_token_required, owner_token, role) VALUES (1,1,?,?,?,?)",
            ("owner", 0, "", "OWNER"),
        )

    if not q1("SELECT path FROM repo_policies LIMIT 1"):
        exec_sql(
            "INSERT INTO repo_policies (path, enabled, allowed_actions, writable_paths, require_pre_approval, require_post_approval) VALUES (?,?,?,?,?,?)",
            (str(ROOT.resolve()), 1, jdump(default_actions), jdump(default_writable), 0, 1),
        )
    else:
        # Portability guard: ensure current workspace has an active policy entry.
        root_path = str(ROOT.resolve())
        existing = q1("SELECT path, enabled, allowed_actions, writable_paths FROM repo_policies WHERE path=?", (root_path,))
        if not existing:
            exec_sql(
                "INSERT INTO repo_policies (path, enabled, allowed_actions, writable_paths, require_pre_approval, require_post_approval) VALUES (?,?,?,?,?,?)",
                (root_path, 1, jdump(default_actions), jdump(default_writable), 0, 1),
            )
        else:
            updates = {}
            if int(existing["enabled"]) == 0:
                updates["enabled"] = 1
            current_actions = parse_json(existing["allowed_actions"], [])
            merged_actions = list(dict.fromkeys(current_actions + default_actions))
            if merged_actions != current_actions:
                updates["allowed_actions"] = jdump(merged_actions)
            current_writable = parse_json(existing["writable_paths"], [])
            merged_writable = list(dict.fromkeys(current_writable + default_writable))
            if merged_writable != current_writable:
                updates["writable_paths"] = jdump(merged_writable)
            if updates:
                exec_sql(
                    "UPDATE repo_policies SET enabled=?, allowed_actions=?, writable_paths=? WHERE path=?",
                    (
                        int(updates.get("enabled", int(existing["enabled"]))),
                        updates.get("allowed_actions", existing["allowed_actions"]),
                        updates.get("writable_paths", existing["writable_paths"]),
                        root_path,
                    ),
                )

    if not q1("SELECT key FROM app_settings WHERE key='default_approval_mode'"):
        exec_sql("INSERT INTO app_settings (key, value) VALUES (?,?)", ("default_approval_mode", "manual_post"))
    if not q1("SELECT key FROM app_settings WHERE key='execution_mode'"):
        exec_sql("INSERT INTO app_settings (key, value) VALUES (?,?)", ("execution_mode", "codex"))
    else:
        mode = app_setting("execution_mode", "codex")
        if mode == "template":
            set_app_setting("execution_mode", "codex")
    if not q1("SELECT key FROM app_settings WHERE key='codex_model'"):
        exec_sql("INSERT INTO app_settings (key, value) VALUES (?,?)", ("codex_model", ""))
    if not q1("SELECT key FROM app_settings WHERE key='codex_timeout_sec'"):
        exec_sql("INSERT INTO app_settings (key, value) VALUES (?,?)", ("codex_timeout_sec", "900"))

    if not q1("SELECT id FROM usage_stats WHERE id = 1"):
        exec_sql(
            "INSERT INTO usage_stats (id, started_at, api_calls_total, last_api_at, last_api_method, last_api_path) VALUES (1,?,?,?,?,?)",
            (utc_now(), 0, "", "", ""),
        )

    if not q1("SELECT id FROM agent_status LIMIT 1"):
        now = utc_now()
        agents = [
            ("ceo", "CEO Agent", "Executive", "healthy", "대기", "Priority governance", "Board", now, 120, 0.01, "CTO Agent", None),
            ("cto", "CTO Agent", "Executive", "healthy", "대기", "Technical governance", "Engineering", now, 150, 0.01, "Product Planning Agent", None),
            ("strategy", "Business Strategy Agent", "Business", "healthy", "대기", "Opportunity mapping", "Growth", now, 170, 0.01, "Marketing Agent", None),
            ("marketing", "Marketing Agent", "Business", "healthy", "대기", "Demand planning", "Demand Gen", now, 180, 0.01, "Product Planning Agent", None),
            ("product", "Product Planning Agent", "Product", "healthy", "대기", "Scope quality", "PM", now, 190, 0.01, "Frontend Agent", None),
            ("backend", "Backend Agent", "Engineering", "healthy", "대기", "Service reliability", "Backend Squad", now, 200, 0.01, "QA Agent", None),
            ("frontend", "Frontend Agent", "Engineering", "healthy", "대기", "UX integrity", "Web Squad", now, 210, 0.01, "QA Agent", None),
            ("app", "App Agent", "Engineering", "healthy", "대기", "Mobile quality", "Mobile Squad", now, 190, 0.01, "QA Agent", None),
            ("design", "Design Ops Agent", "Design", "healthy", "대기", "UI coherence", "Design Ops", now, 180, 0.01, "Frontend Agent", None),
            ("security", "Security Agent", "Security", "healthy", "대기", "Secure delivery", "Security Ops", now, 175, 0.01, "QA Agent", None),
            ("qa", "QA Agent", "Reliability", "healthy", "대기", "Release confidence", "QA Team", now, 160, 0.01, "Infrastructure Agent", None),
            ("infra", "Infrastructure Agent", "Reliability", "healthy", "대기", "SLO protection", "SRE", now, 170, 0.01, "CTO Agent", None),
        ]
        DB.executemany(
            "INSERT INTO agent_status (id,name,team,status,current_task,initiative,owner,last_update,latency_ms,error_rate,next_handoff,blocker) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            agents,
        )
        DB.commit()
    else:
        # Backward-compatible bootstrap: add new team agents if this DB was seeded before.
        if not q1("SELECT id FROM agent_status WHERE id='design'"):
            now = utc_now()
            exec_sql(
                "INSERT INTO agent_status (id,name,team,status,current_task,initiative,owner,last_update,latency_ms,error_rate,next_handoff,blocker) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                ("design", "Design Ops Agent", "Design", "healthy", "대기", "UI coherence", "Design Ops", now, 180, 0.01, "Frontend Agent", None),
            )
        if not q1("SELECT id FROM agent_status WHERE id='security'"):
            now = utc_now()
            exec_sql(
                "INSERT INTO agent_status (id,name,team,status,current_task,initiative,owner,last_update,latency_ms,error_rate,next_handoff,blocker) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                ("security", "Security Agent", "Security", "healthy", "대기", "Secure delivery", "Security Ops", now, 175, 0.01, "QA Agent", None),
            )

    if not q1("SELECT key FROM state_meta WHERE key='company_mission'"):
        exec_sql("INSERT INTO state_meta (key, value) VALUES (?,?)", ("company_mission", "클라이언트 요청 대기"))
    if not q1("SELECT key FROM state_meta WHERE key='work_type'"):
        exec_sql("INSERT INTO state_meta (key, value) VALUES (?,?)", ("work_type", "대기"))
    if not q1("SELECT key FROM state_meta WHERE key='updated_at'"):
        exec_sql("INSERT INTO state_meta (key, value) VALUES (?,?)", ("updated_at", utc_now()))


def list_git_repositories():
    repos = []
    candidates = [ROOT] + [p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")]
    for directory in candidates:
        if (directory / ".git").is_dir():
            repos.append({"name": directory.name, "path": str(directory.resolve())})
    seen = set()
    out = []
    for item in repos:
        if item["path"] in seen:
            continue
        seen.add(item["path"])
        out.append(item)
    return out


def touch_api_usage(method, path):
    row = q1("SELECT * FROM usage_stats WHERE id = 1")
    total = int(row["api_calls_total"]) + 1
    exec_sql(
        "UPDATE usage_stats SET api_calls_total=?, last_api_at=?, last_api_method=?, last_api_path=? WHERE id=1",
        (total, utc_now(), method, path),
    )


def append_audit(kind, owner_id=None, job_id=None, request_id=None, repository=None, phase=None, client=None, detail=None):
    exec_sql(
        "INSERT INTO audit_events (at, kind, owner_id, job_id, request_id, repository, phase, client, detail) VALUES (?,?,?,?,?,?,?,?,?)",
        (utc_now(), kind, owner_id, job_id, request_id, repository, phase, client, jdump(detail or {})),
    )


def owner_config():
    row = q1("SELECT * FROM owner_config WHERE id=1")
    return {
        "owner_mode_enabled": bool(row["owner_mode_enabled"]),
        "owner_id": row["owner_id"],
        "owner_token_required": bool(row["owner_token_required"]),
        "owner_token": row["owner_token"],
        "role": row["role"],
    }


def validate_owner(payload):
    cfg = owner_config()
    if not cfg["owner_mode_enabled"]:
        return True, ""
    owner = (payload.get("owner_id") or "").strip()
    if owner != cfg["owner_id"]:
        return False, f"owner mismatch (expected: {cfg['owner_id']})"
    if cfg["owner_token_required"] and (payload.get("owner_token") or "") != cfg["owner_token"]:
        return False, "invalid owner token"
    return True, ""


def repo_policy(path):
    row = q1("SELECT * FROM repo_policies WHERE path=?", (path,))
    if not row:
        return None
    return {
        "path": row["path"],
        "enabled": bool(row["enabled"]),
        "allowed_actions": parse_json(row["allowed_actions"], []),
        "writable_paths": parse_json(row["writable_paths"], []),
        "require_pre_approval": bool(row["require_pre_approval"]),
        "require_post_approval": bool(row["require_post_approval"]),
    }


def default_approval_mode():
    row = q1("SELECT value FROM app_settings WHERE key='default_approval_mode'")
    return row["value"] if row else "manual_post"


def app_setting(key, default=""):
    row = q1("SELECT value FROM app_settings WHERE key=?", (key,))
    return row["value"] if row else default


def set_app_setting(key, value):
    if q1("SELECT key FROM app_settings WHERE key=?", (key,)):
        exec_sql("UPDATE app_settings SET value=? WHERE key=?", (value, key))
    else:
        exec_sql("INSERT INTO app_settings (key, value) VALUES (?,?)", (key, value))


def discover_codex_models(refresh=False):
    models = list(DEFAULT_CODEX_MODELS)
    configured = app_setting("codex_model", "").strip()
    if configured:
        models.insert(0, configured)

    cached = parse_json(app_setting("codex_model_catalog", "[]"), [])
    if isinstance(cached, list):
        models.extend([m for m in cached if isinstance(m, str)])

    source = "defaults+cache"
    if refresh:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if api_key:
            try:
                req = Request("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {api_key}"})
                with urlopen(req, timeout=8) as res:
                    payload = json.loads(res.read().decode("utf-8"))
                ids = sorted([x.get("id", "") for x in payload.get("data", []) if isinstance(x, dict) and x.get("id")])
                picked = [m for m in ids if "gpt" in m or "o" in m]
                if picked:
                    set_app_setting("codex_model_catalog", jdump(picked))
                    set_app_setting("codex_model_catalog_updated_at", utc_now())
                    models.extend(picked)
                    source = "openai_models_api"
            except (URLError, TimeoutError, json.JSONDecodeError, Exception):
                source = "defaults+cache"

    uniq = []
    seen = set()
    for m in models:
        if not m or m in seen:
            continue
        seen.add(m)
        uniq.append(m)

    return {
        "models": uniq,
        "source": source,
        "updated_at": app_setting("codex_model_catalog_updated_at", ""),
    }


def update_agent(agent_id, **kwargs):
    row = q1("SELECT * FROM agent_status WHERE id=?", (agent_id,))
    if not row:
        return
    data = dict(row)
    for key in ["status", "current_task", "initiative", "latency_ms", "error_rate", "blocker"]:
        if key in kwargs:
            data[key] = kwargs[key]
    data["last_update"] = utc_now()
    exec_sql(
        "UPDATE agent_status SET status=?, current_task=?, initiative=?, latency_ms=?, error_rate=?, blocker=?, last_update=? WHERE id=?",
        (data["status"], data["current_task"], data["initiative"], data["latency_ms"], data["error_rate"], data.get("blocker"), data["last_update"], agent_id),
    )


def set_meta(key, value):
    if q1("SELECT key FROM state_meta WHERE key=?", (key,)):
        exec_sql("UPDATE state_meta SET value=? WHERE key=?", (value, key))
    else:
        exec_sql("INSERT INTO state_meta (key, value) VALUES (?,?)", (key, value))


def state_snapshot():
    agents = [dict(r) for r in q("SELECT * FROM agent_status")]
    summary = {"total": len(agents), "healthy": 0, "warning": 0, "critical": 0}
    for a in agents:
        if a["status"] in summary:
            summary[a["status"]] += 1

    return {
        "updated_at": q1("SELECT value FROM state_meta WHERE key='updated_at'")["value"],
        "company_mission": q1("SELECT value FROM state_meta WHERE key='company_mission'")["value"],
        "work_type": q1("SELECT value FROM state_meta WHERE key='work_type'")["value"],
        "summary": summary,
        "agents": agents,
    }


def requests_snapshot():
    rows = [dict(r) for r in q("SELECT * FROM requests ORDER BY created_at DESC")]
    return {"requests": rows}


def jobs_snapshot():
    rows = [dict(r) for r in q("SELECT * FROM jobs ORDER BY created_at DESC")]
    for row in rows:
        for key in ["executed_actions", "changed_files", "pm_notes", "cto_notes", "dev_notes", "qa_notes", "timeline"]:
            row[key] = parse_json(row.get(key), [])
        row["apply_changes"] = bool(row.get("apply_changes"))
        row["pre_approved"] = bool(row.get("pre_approved"))
        row["post_approved"] = bool(row.get("post_approved"))
    return {"jobs": rows}


def usage_snapshot():
    row = dict(q1("SELECT * FROM usage_stats WHERE id=1"))
    requests_total = q1("SELECT COUNT(*) AS c FROM requests")["c"]
    jobs_total = q1("SELECT COUNT(*) AS c FROM jobs")["c"]
    jobs_done = q1("SELECT COUNT(*) AS c FROM jobs WHERE status='done'")["c"]
    waiting = q1("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('waiting_pre_approval','waiting_post_approval')")["c"]
    approvals = q1("SELECT COUNT(*) AS c FROM audit_events WHERE kind='job_approved'")["c"]
    responses = q1("SELECT COUNT(*) AS c FROM audit_events WHERE kind='client_responded'")["c"]
    files_changed = 0
    actions = 0
    for r in q("SELECT changed_files, executed_actions FROM jobs"):
        files_changed += len(parse_json(r["changed_files"], []))
        actions += len(parse_json(r["executed_actions"], []))

    return {
        "scope": "local_orchestrator_usage",
        "started_at": row["started_at"],
        "api_calls_total": int(row["api_calls_total"]),
        "requests_total": int(requests_total),
        "jobs_total": int(jobs_total),
        "jobs_done": int(jobs_done),
        "jobs_waiting_approval": int(waiting),
        "approvals_total": int(approvals),
        "responses_total": int(responses),
        "actions_executed_total": int(actions),
        "files_changed_total": int(files_changed),
        "last_api_at": row.get("last_api_at", ""),
    }


def run_cmd(repo_path, args):
    result = subprocess.run(args, cwd=repo_path, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        return f"(failed: {' '.join(args)})\n{result.stderr.strip()}"
    return (result.stdout or "").strip()


def snapshot_writable_files(writable_paths):
    snapshot = {}
    for base in writable_paths:
        root = Path(base).resolve()
        if root.is_file():
            st = root.stat()
            snapshot[str(root)] = (st.st_mtime_ns, st.st_size)
            continue
        if not root.is_dir():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            st = p.stat()
            snapshot[str(p.resolve())] = (st.st_mtime_ns, st.st_size)
    return snapshot


def diff_file_snapshot(before, after):
    changed = []
    for path in sorted(set(before) | set(after)):
        if before.get(path) != after.get(path):
            changed.append(path)
    return changed


def apply_dashboard_snb(repo_path):
    idx = repo_path / "dashboard" / "index.html"
    css = repo_path / "dashboard" / "styles.css"
    if not (idx.exists() and css.exists()):
        raise RuntimeError("dashboard files missing")
    idx_txt = idx.read_text(encoding="utf-8")
    css_txt = css.read_text(encoding="utf-8")
    if "class=\"snb\"" not in idx_txt:
        idx_txt = idx_txt.replace(
            "<body>",
            "<body>\n  <div class=\"workspace\">\n    <aside class=\"snb\">\n      <div class=\"snb-title\">운영 콘솔</div>\n      <button class=\"nav-item active\" data-target=\"all\">전체 보기</button>\n    </aside>\n    <div class=\"workspace-main\">",
            1,
        )
        idx_txt = idx_txt.replace("</main>", "</main>\n    </div>\n  </div>", 1)
    if "/* SNB Layout */" not in css_txt:
        css_txt += "\n/* SNB Layout */\n.workspace{display:grid;grid-template-columns:220px 1fr;}\n"
    idx.write_text(idx_txt, encoding="utf-8")
    css.write_text(css_txt, encoding="utf-8")
    return [str(idx), str(css)]


def apply_work_intake_menu(repo_path):
    idx = repo_path / "dashboard" / "index.html"
    css = repo_path / "dashboard" / "styles.css"
    if not (idx.exists() and css.exists()):
        raise RuntimeError("dashboard files missing")
    idx_txt = idx.read_text(encoding="utf-8")
    css_txt = css.read_text(encoding="utf-8")
    if "id=\"intakePresets\"" not in idx_txt and "2) oh-my-agnet-company에 작업 할당" in idx_txt:
        idx_txt = idx_txt.replace(
            "<h2>2) oh-my-agnet-company에 작업 할당</h2>",
            "<h2>2) oh-my-agnet-company에 작업 할당</h2>\n      <div class=\"intake-presets\" id=\"intakePresets\"></div>",
            1,
        )
    if ".intake-presets" not in css_txt:
        css_txt += "\n.intake-presets{display:flex;gap:0.4rem;}\n"
    idx.write_text(idx_txt, encoding="utf-8")
    css.write_text(css_txt, encoding="utf-8")
    return [str(idx), str(css)]


def apply_audit_log_readability(repo_path):
    app = repo_path / "dashboard" / "app.js"
    css = repo_path / "dashboard" / "styles.css"
    if not (app.exists() and css.exists()):
        raise RuntimeError("dashboard files missing")
    app_txt = app.read_text(encoding="utf-8")
    css_txt = css.read_text(encoding="utf-8")

    if "function escapeHtml(value)" not in app_txt:
        app_txt = app_txt.replace(
            "let timer = null;\n",
            "let timer = null;\n\nfunction escapeHtml(value) {\n  return String(value ?? \"\")\n    .replaceAll(\"&\", \"&amp;\")\n    .replaceAll(\"<\", \"&lt;\")\n    .replaceAll(\">\", \"&gt;\")\n    .replaceAll('\"', \"&quot;\")\n    .replaceAll(\"'\", \"&#39;\");\n}\n",
            1,
        )

    old_detail = "<td><code>${JSON.stringify(e)}</code></td>"
    new_detail = "<td class=\\\"audit-detail\\\"><pre><code>${escapeHtml(JSON.stringify(e, null, 2))}</code></pre></td>"
    if old_detail in app_txt:
        app_txt = app_txt.replace(old_detail, new_detail, 1)

    if ".audit-detail" not in css_txt:
        css_txt += (
            "\n.audit-detail{min-width:320px;max-width:56vw;}\n"
            ".audit-detail pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;line-height:1.35;}\n"
            ".audit-detail code{font-size:0.8rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}\n"
        )

    app.write_text(app_txt, encoding="utf-8")
    css.write_text(css_txt, encoding="utf-8")
    return [str(app), str(css)]


def detect_actions(job):
    txt = f"{job.get('refined_request','')} {job.get('work_type','')} {job.get('mission','')}".lower()
    out = []
    if any(k in txt for k in ["snb", "sidebar", "사이드바"]):
        out.append("dashboard_snb")
    if any(k in txt for k in ["work intake", "intake", "menu", "메뉴", "메뉴화"]):
        out.append("work_intake_menu")
    if any(k in txt for k in ["audit", "감사로그", "감사 로그", "ux", "가독성", "줄바꿈", "세로"]):
        out.append("audit_log_readability")
    return out


def check_changed_files_policy(changed_files, policy):
    roots = [str(Path(p).resolve()) for p in policy["writable_paths"]]
    if not roots:
        return False, "no writable paths configured"
    for file_path in changed_files:
        resolved = str(Path(file_path).resolve())
        if not any(resolved.startswith(root) for root in roots):
            return False, f"changed file out of policy: {resolved}"
    return True, ""


def execute_actions(job, policy):
    repo_path = Path(job["repository"])
    executed = []
    changed = []
    for action in detect_actions(job):
        if action not in policy["allowed_actions"]:
            continue
        if action == "dashboard_snb":
            changed.extend(apply_dashboard_snb(repo_path))
            executed.append(action)
        if action == "work_intake_menu":
            changed.extend(apply_work_intake_menu(repo_path))
            executed.append(action)
        if action == "audit_log_readability":
            changed.extend(apply_audit_log_readability(repo_path))
            executed.append(action)
    changed = list(dict.fromkeys(changed))
    ok, reason = check_changed_files_policy(changed, policy)
    if not ok:
        raise RuntimeError(reason)
    return executed, changed


def execute_actions_with_codex(job, policy):
    repo_path = Path(job["repository"]).resolve()
    codex_bin = app_setting("codex_bin", "codex").strip() or "codex"
    codex_model = app_setting("codex_model", "").strip()
    timeout_sec = int(app_setting("codex_timeout_sec", "900") or "900")

    before = snapshot_writable_files(policy["writable_paths"])
    prompt = (
        "You are the Dev team in oh-my-agnet-company.\\n"
        "Task: apply the refined request below and edit files directly in the repository.\\n"
        "Follow constraints strictly:\\n"
        f"- Repository root: {repo_path}\\n"
        f"- Writable paths: {', '.join(policy['writable_paths'])}\\n"
        "- Do not modify files outside writable paths.\\n"
        "- Make concrete code/UI changes, not just analysis.\\n"
        "- Keep changes minimal and deterministic.\\n\\n"
        f"Work type: {job.get('work_type','')}\\n"
        f"Mission: {job.get('mission','')}\\n"
        f"Refined request:\\n{job.get('refined_request','')}\\n"
    )

    cmd = [codex_bin, "exec", "--full-auto", "-s", "workspace-write", "-C", str(repo_path), "--skip-git-repo-check"]
    if codex_model:
        cmd.extend(["-m", codex_model])
    cmd.append(prompt)

    try:
        result = subprocess.run(cmd, cwd=str(repo_path), text=True, capture_output=True, check=False, timeout=timeout_sec)
    except FileNotFoundError:
        raise RuntimeError(f"codex binary not found: {codex_bin}")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"codex execution timeout after {timeout_sec}s")

    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        snippet = err.splitlines()[:6]
        raise RuntimeError("codex execution failed: " + " | ".join(snippet))

    after = snapshot_writable_files(policy["writable_paths"])
    changed = diff_file_snapshot(before, after)
    ok, reason = check_changed_files_policy(changed, policy)
    if not ok:
        raise RuntimeError(reason)

    out = (result.stdout or "").strip()
    summary = "codex exec completed"
    if out:
        summary = out.splitlines()[-1][:180]
    return ["codex_exec"], changed, summary


def set_job_fields(job_id, fields):
    row = q1("SELECT * FROM jobs WHERE id=?", (job_id,))
    if not row:
        return
    data = dict(row)
    data.update(fields)
    exec_sql(
        """
        UPDATE jobs SET
          status=?, stage=?, dispatched_at=?, started_at=?, completed_at=?, report_path=?,
          pre_approved=?, pre_approved_at=?, post_approved=?, post_approved_at=?,
          error=?, executed_actions=?, changed_files=?, pm_notes=?, cto_notes=?, dev_notes=?, qa_notes=?, timeline=?
        WHERE id=?
        """,
        (
            data.get("status"), data.get("stage"), data.get("dispatched_at"), data.get("started_at"), data.get("completed_at"), data.get("report_path"),
            int(bool(data.get("pre_approved"))), data.get("pre_approved_at"), int(bool(data.get("post_approved"))), data.get("post_approved_at"),
            data.get("error"),
            jdump(parse_json(data.get("executed_actions"), []) if isinstance(data.get("executed_actions"), str) else data.get("executed_actions") or []),
            jdump(parse_json(data.get("changed_files"), []) if isinstance(data.get("changed_files"), str) else data.get("changed_files") or []),
            jdump(parse_json(data.get("pm_notes"), []) if isinstance(data.get("pm_notes"), str) else data.get("pm_notes") or []),
            jdump(parse_json(data.get("cto_notes"), []) if isinstance(data.get("cto_notes"), str) else data.get("cto_notes") or []),
            jdump(parse_json(data.get("dev_notes"), []) if isinstance(data.get("dev_notes"), str) else data.get("dev_notes") or []),
            jdump(parse_json(data.get("qa_notes"), []) if isinstance(data.get("qa_notes"), str) else data.get("qa_notes") or []),
            jdump(parse_json(data.get("timeline"), []) if isinstance(data.get("timeline"), str) else data.get("timeline") or []),
            job_id,
        ),
    )


def add_timeline(job_id, message):
    row = q1("SELECT timeline FROM jobs WHERE id=?", (job_id,))
    timeline = parse_json(row["timeline"], [])
    timeline.append({"at": utc_now(), "message": message})
    set_job_fields(job_id, {"timeline": timeline})


def update_request(request_id, fields):
    row = q1("SELECT * FROM requests WHERE id=?", (request_id,))
    if not row:
        return
    data = dict(row)
    data.update(fields)
    exec_sql(
        "UPDATE requests SET status=?, linked_job_id=?, assigned_at=?, completed_at=?, response_note=?, responded_at=? WHERE id=?",
        (data.get("status"), data.get("linked_job_id"), data.get("assigned_at"), data.get("completed_at"), data.get("response_note"), data.get("responded_at"), request_id),
    )


def agent_note(role, stage, text):
    time.sleep(random.uniform(0.2, 0.8))
    return {"role": role, "stage": stage, "note": f"{role} {stage}: {text[:120]}", "at": utc_now()}


def parse_utc(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def build_post_completion_audit(job):
    recent_rows = [dict(r) for r in q("SELECT id,status,created_at,started_at,completed_at FROM jobs ORDER BY created_at DESC LIMIT 20")]
    total_recent = len(recent_rows)
    done_recent = len([r for r in recent_rows if r.get("status") == "done"])
    failed_recent = len([r for r in recent_rows if r.get("status") == "failed"])

    durations = []
    for row in recent_rows:
        if row.get("status") != "done":
            continue
        started_at = parse_utc(row.get("started_at"))
        completed_at = parse_utc(row.get("completed_at"))
        if started_at and completed_at and completed_at >= started_at:
            durations.append(int((completed_at - started_at).total_seconds()))

    avg_duration_sec = int(sum(durations) / len(durations)) if durations else None
    failure_rate = round((failed_recent / total_recent), 3) if total_recent else 0.0

    now_utc = datetime.now(timezone.utc)
    queue_backlog = []
    running_backlog = []
    for row in q("SELECT id,status,stage,created_at,started_at FROM jobs WHERE status IN ('queued','dispatching','in_progress','waiting_pre_approval','waiting_post_approval') ORDER BY created_at"):
        item = dict(row)
        base_ts = parse_utc(item.get("started_at")) or parse_utc(item.get("created_at"))
        if not base_ts:
            continue
        age_sec = int((now_utc - base_ts).total_seconds())
        out = {
            "id": item["id"],
            "status": item["status"],
            "stage": item["stage"],
            "age_sec": age_sec,
        }
        if item["status"] == "queued":
            queue_backlog.append(out)
        else:
            running_backlog.append(out)

    recommendations = []
    if failure_rate >= 0.2:
        recommendations.append("최근 실패율이 높습니다. 입력 프롬프트 정제 규칙과 Codex 인자 검증을 강화하세요.")
    if any(x["age_sec"] > 600 for x in running_backlog):
        recommendations.append("10분 이상 진행 중인 작업이 있습니다. 단계별 타임아웃/재시도 규칙을 추가하세요.")
    if any(x["age_sec"] > 300 for x in queue_backlog):
        recommendations.append("5분 이상 대기 큐가 있습니다. 워커 상태 점검 후 재디스패치 정책을 적용하세요.")
    if not recommendations:
        recommendations.append("현재 상태는 안정적입니다. 기존 승인 게이트와 감사로그 정책을 유지하세요.")

    summary = {
        "generated_at": utc_now(),
        "subject_job_id": job["id"],
        "recent_window": {
            "jobs": total_recent,
            "done": done_recent,
            "failed": failed_recent,
            "failure_rate": failure_rate,
            "avg_done_duration_sec": avg_duration_sec,
        },
        "running_backlog": running_backlog[:5],
        "queue_backlog": queue_backlog[:5],
        "recommendations": recommendations,
    }
    return summary


def build_client_delivery_message(job, actions, changed_files, post_audit=None):
    changed_display = display_paths(changed_files)
    key_files = changed_display[:3]
    recs = (post_audit or {}).get("recommendations", [])[:2]
    lines = [
        "[변경점]",
        f"- 요청 ID: {job.get('request_id', '-')}",
        f"- 수행 액션: {', '.join(actions) if actions else '(none)'}",
        f"- 핵심 변경 파일: {', '.join(key_files) if key_files else '(none)'}",
        "",
        "[영향]",
        "- 대시보드 운영 흐름의 가독성과 추적성이 개선되었습니다.",
        "- 승인/감사 기준을 따라 변경 이력이 남습니다.",
        "",
        "[리스크]",
    ]
    if recs:
        lines.extend([f"- {x}" for x in recs])
    else:
        lines.append("- 현재 기준 중대 리스크는 확인되지 않았습니다.")
    lines.extend(
        [
            "",
            "[다음 조치]",
            "- 운영자가 대시보드에서 결과를 확인하고 필요 시 추가 요청을 접수합니다.",
            "- 후속 개선 요청은 동일 요청 ID 기준으로 추적합니다.",
        ]
    )
    return "\n".join(lines)


def normalize_client_response_note(raw_note, request_row=None):
    note = (raw_note or "").strip()
    if not note:
        return ""
    required = ["[변경점]", "[영향]", "[리스크]", "[다음 조치]"]
    if all(x in note for x in required):
        return note
    request_id = request_row["id"] if request_row else "-"
    client = request_row["client_name"] if request_row else "-"
    return "\n".join(
        [
            "[변경점]",
            f"- 요청 ID: {request_id}",
            f"- 전달 내용: {note}",
            "",
            "[영향]",
            f"- {client} 요청에 대한 진행/결과를 이해하기 쉽게 요약했습니다.",
            "",
            "[리스크]",
            "- 추가 확인이 필요한 항목이 있으면 운영자가 후속 점검합니다.",
            "",
            "[다음 조치]",
            "- 필요 시 세부 요구사항을 추가로 전달해 주세요.",
        ]
    )


def write_report(job, actions, changed_files, notes, post_audit=None):
    repo_path = Path(job["repository"])
    DELIVERABLE_DIR.mkdir(parents=True, exist_ok=True)
    report_path = DELIVERABLE_DIR / f"job-{job['id']}.md"
    branch = run_cmd(repo_path, ["git", "rev-parse", "--abbrev-ref", "HEAD"])
    status = run_cmd(repo_path, ["git", "status", "--short"])
    lines = [
        f"# Client Job Report: {job['id']}",
        "",
        f"- Owner: {job.get('owner_id','-')}",
        f"- Client: {job['client_name']}",
        f"- Request ID: {job['request_id']}",
        f"- Work Type: {job['work_type']}",
        f"- Mission: {job['mission']}",
        f"- Repository: {display_path(job['repository'])}",
        f"- Approval Mode: {job.get('approval_mode','auto')}",
        f"- Processed At (UTC): {utc_now()}",
        "",
        "## Pipeline Notes (PM -> CTO -> Dev -> QA -> Report)",
    ]
    for note in notes:
        lines.append(f"- [{note['stage']}] {note['role']}: {note['note']}")
    lines.extend(["", "## Execution", f"- Executed Actions: {', '.join(actions) if actions else '(none)'}", "- Changed Files:"])
    if changed_files:
        lines.extend([f"  - {x}" for x in display_paths(changed_files)])
    else:
        lines.append("  - (none)")
    lines.extend(["", "## Post-Completion Audit"])
    if post_audit:
        window = post_audit.get("recent_window", {})
        lines.extend(
            [
                f"- Jobs (window): {window.get('jobs', 0)}",
                f"- Done: {window.get('done', 0)}",
                f"- Failed: {window.get('failed', 0)}",
                f"- Failure Rate: {window.get('failure_rate', 0.0)}",
                f"- Avg Done Duration (sec): {window.get('avg_done_duration_sec', '-')}",
                "- Recommendations:",
            ]
        )
        recs = post_audit.get("recommendations", [])
        if recs:
            lines.extend([f"  - {r}" for r in recs])
        else:
            lines.append("  - (none)")
    else:
        lines.append("- (audit unavailable)")
    client_message = build_client_delivery_message(job, actions, changed_files, post_audit)
    lines.extend(["", "## Client Delivery Message (Template)", "```text", client_message, "```"])
    lines.extend(["", "## Working Tree", f"- Branch: {branch}", "```text", status or "(clean)", "```"])
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return display_path(report_path)


def wait_for_approval(job_id, phase):
    while True:
        row = q1("SELECT pre_approved, post_approved FROM jobs WHERE id=?", (job_id,))
        if not row:
            return
        if phase == "pre" and int(row["pre_approved"]) == 1:
            return
        if phase == "post" and int(row["post_approved"]) == 1:
            return
        time.sleep(1)


def run_pipeline(job):
    policy = repo_policy(job["repository"])
    if not policy or not policy["enabled"]:
        raise RuntimeError("repository policy not found")

    set_meta("company_mission", job["mission"])
    set_meta("work_type", job["work_type"])
    set_meta("updated_at", utc_now())

    update_agent("product", status="warning", current_task="PM scoping", initiative="Scope lock", latency_ms=320, error_rate=0.03, blocker=None)
    set_job_fields(job["id"], {"status": "in_progress", "stage": "pm", "started_at": utc_now()})
    add_timeline(job["id"], "PM stage started.")
    pm_notes = [agent_note("Product Planning", "PM", job["refined_request"])]
    set_job_fields(job["id"], {"pm_notes": pm_notes})

    update_agent("cto", status="warning", current_task="CTO architecture review", initiative="Feasibility", latency_ms=330, error_rate=0.04, blocker=None)
    set_job_fields(job["id"], {"stage": "cto"})
    add_timeline(job["id"], "CTO stage started.")
    cto_notes = [agent_note("CTO", "CTO", job["refined_request"])]
    set_job_fields(job["id"], {"cto_notes": cto_notes})

    if job["approval_mode"] in ["manual_pre", "manual_both"]:
        set_job_fields(job["id"], {"status": "waiting_pre_approval", "stage": "pre_approval"})
        add_timeline(job["id"], "Waiting for pre-change approval.")
        append_audit("approval_wait", owner_id=job["owner_id"], job_id=job["id"], phase="pre")
        wait_for_approval(job["id"], "pre")

    for aid, task in [
        ("backend", "Backend implementation"),
        ("frontend", "Frontend implementation"),
        ("app", "App impact validation"),
        ("design", "Design system alignment"),
        ("security", "Security review and hardening"),
        ("infra", "Infra deployment prep"),
    ]:
        update_agent(aid, status="warning", current_task=task, initiative="Dev stage", latency_ms=340, error_rate=0.04, blocker=None)
    set_job_fields(job["id"], {"stage": "dev"})
    add_timeline(job["id"], "Dev stage started in parallel.")

    with ThreadPoolExecutor(max_workers=6) as pool:
        dev_notes = list(
            pool.map(
                lambda role: agent_note(role, "Dev", job["refined_request"]),
                ["Backend", "Frontend", "App", "Design", "Security", "Infrastructure"],
            )
        )

    actions = []
    changed_files = []
    execution_mode = app_setting("execution_mode", "codex")
    if int(job["apply_changes"]) == 1:
        if execution_mode == "codex":
            actions, changed_files, codex_summary = execute_actions_with_codex(job, policy)
            dev_notes.append({"role": "Codex", "stage": "Dev", "note": f"Codex run: {codex_summary}", "at": utc_now()})
        else:
            actions, changed_files = execute_actions(job, policy)
        if not actions:
            raise RuntimeError(f"no executable actions detected in mode={execution_mode}; refine request")

    changed_display = display_paths(changed_files)
    set_job_fields(job["id"], {"dev_notes": dev_notes, "executed_actions": actions, "changed_files": changed_display})

    if job["approval_mode"] in ["manual_post", "manual_both"]:
        set_job_fields(job["id"], {"status": "waiting_post_approval", "stage": "post_approval"})
        add_timeline(job["id"], "Waiting for post-change approval.")
        append_audit("approval_wait", owner_id=job["owner_id"], job_id=job["id"], phase="post")
        wait_for_approval(job["id"], "post")

    update_agent("qa", status="warning", current_task="QA validation", initiative="Release gate", latency_ms=300, error_rate=0.03, blocker=None)
    set_job_fields(job["id"], {"stage": "qa"})
    add_timeline(job["id"], "QA stage started.")
    qa_notes = [agent_note("QA", "QA", "Regression and release checks")]

    post_audit = build_post_completion_audit(job)
    report_path = write_report(job, actions, changed_files, pm_notes + cto_notes + dev_notes + qa_notes, post_audit=post_audit)

    for aid in ["ceo", "cto", "strategy", "marketing", "product", "backend", "frontend", "app", "design", "security", "qa", "infra"]:
        update_agent(aid, status="healthy", latency_ms=170, error_rate=0.01, blocker=None)
    update_agent("ceo", current_task="Client delivery report", initiative="Owner briefing")
    set_meta("updated_at", utc_now())

    client_message = build_client_delivery_message(job, actions, changed_files, post_audit)
    set_job_fields(job["id"], {
        "status": "done",
        "stage": "report",
        "qa_notes": qa_notes,
        "completed_at": utc_now(),
        "report_path": report_path,
    })
    add_timeline(job["id"], "Report stage complete. Job done.")
    update_request(job["request_id"], {"status": "completed", "completed_at": utc_now(), "response_note": client_message})

    append_audit(
        "job_done",
        owner_id=job["owner_id"],
        job_id=job["id"],
        request_id=job["request_id"],
        repository=display_path(job["repository"]),
        detail={"executed_actions": actions, "changed_files": changed_display},
    )
    append_audit(
        "post_job_audit",
        owner_id=job["owner_id"],
        job_id=job["id"],
        request_id=job["request_id"],
        repository=display_path(job["repository"]),
        phase="post_completion",
        detail={"audit": post_audit, "client_message_template": client_message},
    )
    add_timeline(job["id"], "Post-completion audit generated.")
    append_audit(
        "client_message_prepared",
        owner_id=job["owner_id"],
        job_id=job["id"],
        request_id=job["request_id"],
        repository=display_path(job["repository"]),
        phase="report",
        detail={"template": client_message},
    )


def worker_loop():
    while True:
        try:
            job = q1("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1")
            if not job:
                time.sleep(1)
                continue
            job = dict(job)
            set_job_fields(job["id"], {"status": "dispatching", "stage": "dispatch", "dispatched_at": utc_now()})
            run_pipeline(job)
        except Exception as exc:
            # Keep worker alive on any unexpected error so a single bad job never stops dispatch.
            try:
                if "job" in locals() and isinstance(job, dict) and job.get("id"):
                    set_job_fields(job["id"], {"status": "failed", "stage": "failed", "completed_at": utc_now(), "error": str(exc)})
                    add_timeline(job["id"], f"Failed: {exc}")
                    update_request(job["request_id"], {"status": "received"})
                    append_audit("job_failed", owner_id=job.get("owner_id"), job_id=job["id"], request_id=job.get("request_id"), detail={"error": str(exc)})
                update_agent("qa", status="critical", current_task="Failure triage", initiative="Incident handling", latency_ms=700, error_rate=0.11, blocker=str(exc))
                set_meta("updated_at", utc_now())
            except Exception:
                traceback.print_exc()
            traceback.print_exc()
            time.sleep(0.5)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def handle_one_request(self):
        try:
            return super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            traceback.print_exc()
            try:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "internal server error")
            except Exception:
                pass

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _parse_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def _owner_guard(self, payload):
        ok, reason = validate_owner(payload)
        if ok:
            return True
        self._send_json({"error": reason}, status=HTTPStatus.FORBIDDEN)
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        # Human-friendly entry: open dashboard from root URL.
        if path in ["/", "/index.html"]:
            self.path = "/dashboard/"
            return super().do_GET()
        if path == "/dashboard":
            self.path = "/dashboard/"
            return super().do_GET()
        if path.startswith("/api/"):
            with LOCK:
                touch_api_usage("GET", path)
        if path == "/api/state":
            with LOCK:
                return self._send_json(state_snapshot())
        if path == "/api/requests":
            with LOCK:
                return self._send_json(requests_snapshot())
        if path == "/api/jobs":
            with LOCK:
                return self._send_json(jobs_snapshot())
        if path == "/api/repos":
            with LOCK:
                policies = [dict(r) for r in q("SELECT path, enabled FROM repo_policies WHERE enabled=1")]
                allowed = {r["path"] for r in policies}
                repos = [r for r in list_git_repositories() if r["path"] in allowed]
                return self._send_json({"repositories": repos})
        if path == "/api/policies":
            with LOCK:
                repos = []
                for r in q("SELECT * FROM repo_policies"):
                    repos.append({
                        "path": r["path"],
                        "enabled": bool(r["enabled"]),
                        "allowed_actions": parse_json(r["allowed_actions"], []),
                        "writable_paths": parse_json(r["writable_paths"], []),
                        "require_pre_approval": bool(r["require_pre_approval"]),
                        "require_post_approval": bool(r["require_post_approval"]),
                    })
                return self._send_json({"default_approval_mode": default_approval_mode(), "repositories": repos})
        if path == "/api/owner":
            with LOCK:
                cfg = owner_config()
                safe = dict(cfg)
                safe["owner_token"] = "***" if safe.get("owner_token") else ""
                return self._send_json(safe)
        if path == "/api/settings":
            with LOCK:
                cfg = owner_config()
                return self._send_json(
                    {
                        "owner_id": cfg["owner_id"],
                        "owner_mode_enabled": cfg["owner_mode_enabled"],
                        "default_approval_mode": default_approval_mode(),
                        "execution_mode": app_setting("execution_mode", "codex"),
                        "codex_model": app_setting("codex_model", ""),
                        "polling_enabled": app_setting("polling_enabled", "1") == "1",
                        "polling_interval_sec": int(app_setting("polling_interval_sec", "5") or "5"),
                    }
                )
        if path == "/api/codex/models":
            with LOCK:
                refresh = query.get("refresh", ["0"])[0] == "1"
                return self._send_json(discover_codex_models(refresh=refresh))
        if path == "/api/audit":
            with LOCK:
                rows = [dict(r) for r in q("SELECT * FROM audit_events ORDER BY id DESC LIMIT 200")]
                rows.reverse()
                for row in rows:
                    row["detail"] = parse_json(row.get("detail"), {})
                return self._send_json({"events": rows})
        if path == "/api/usage":
            with LOCK:
                return self._send_json(usage_snapshot())
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            with LOCK:
                touch_api_usage("POST", path)
        try:
            payload = self._parse_json()
        except Exception:
            return self._send_json({"error": "invalid json"}, status=HTTPStatus.BAD_REQUEST)

        if path == "/api/requests":
            if not self._owner_guard(payload):
                return
            required = ["owner_id", "client_name", "raw_request"]
            missing = [x for x in required if not payload.get(x)]
            if missing:
                return self._send_json({"error": f"missing fields: {', '.join(missing)}"}, status=HTTPStatus.BAD_REQUEST)

            request_id = f"req-{int(time.time())}-{random.randint(100,999)}"
            with LOCK:
                exec_sql(
                    "INSERT INTO requests (id, owner_id, client_name, raw_request, status, created_at) VALUES (?,?,?,?,?,?)",
                    (request_id, payload["owner_id"].strip(), payload["client_name"].strip(), payload["raw_request"].strip(), "received", utc_now()),
                )
                append_audit("request_received", owner_id=payload["owner_id"].strip(), request_id=request_id, client=payload["client_name"].strip())
                req = q1("SELECT * FROM requests WHERE id=?", (request_id,))
                return self._send_json({"ok": True, "request": dict(req)}, status=HTTPStatus.CREATED)

        if path == "/api/jobs/from-request":
            if not self._owner_guard(payload):
                return
            required = ["owner_id", "request_id", "work_type", "mission", "repository", "refined_request"]
            missing = [x for x in required if not payload.get(x)]
            if missing:
                return self._send_json({"error": f"missing fields: {', '.join(missing)}"}, status=HTTPStatus.BAD_REQUEST)

            with LOCK:
                req = q1("SELECT * FROM requests WHERE id=?", (payload["request_id"],))
                if not req:
                    return self._send_json({"error": "request not found"}, status=HTTPStatus.NOT_FOUND)
                if req["status"] not in ["received", "completed"]:
                    return self._send_json({"error": "request is not assignable"}, status=HTTPStatus.BAD_REQUEST)

                policy = repo_policy(payload["repository"].strip())
                if not policy or not policy["enabled"]:
                    return self._send_json({"error": "repository not allowed by policy"}, status=HTTPStatus.BAD_REQUEST)

                job_id = f"job-{int(time.time())}-{random.randint(100,999)}"
                approval = payload.get("approval_mode") or default_approval_mode()
                timeline = [{"at": utc_now(), "message": "Owner assigned request to pipeline"}]
                exec_sql(
                    """
                    INSERT INTO jobs (
                      id, owner_id, request_id, client_name, work_type, mission, repository, refined_request,
                      apply_changes, approval_mode, status, stage, created_at, timeline
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        job_id,
                        payload["owner_id"].strip(),
                        payload["request_id"].strip(),
                        req["client_name"],
                        payload["work_type"].strip(),
                        payload["mission"].strip(),
                        payload["repository"].strip(),
                        payload["refined_request"].strip(),
                        int(bool(payload.get("apply_changes", True))),
                        approval,
                        "queued",
                        "queued",
                        utc_now(),
                        jdump(timeline),
                    ),
                )
                update_request(payload["request_id"].strip(), {"status": "in_company", "linked_job_id": job_id, "assigned_at": utc_now()})
                append_audit(
                    "job_assigned",
                    owner_id=payload["owner_id"].strip(),
                    job_id=job_id,
                    request_id=payload["request_id"].strip(),
                    repository=display_path(payload["repository"].strip()),
                    detail={"approval_mode": approval},
                )
                job = dict(q1("SELECT * FROM jobs WHERE id=?", (job_id,)))
                job["timeline"] = parse_json(job["timeline"], [])
                return self._send_json({"ok": True, "job": job}, status=HTTPStatus.CREATED)

        if path == "/api/jobs/approve":
            if not self._owner_guard(payload):
                return
            required = ["owner_id", "job_id", "phase"]
            missing = [x for x in required if not payload.get(x)]
            if missing:
                return self._send_json({"error": f"missing fields: {', '.join(missing)}"}, status=HTTPStatus.BAD_REQUEST)
            phase = payload["phase"].strip().lower()
            if phase not in ["pre", "post"]:
                return self._send_json({"error": "phase must be pre or post"}, status=HTTPStatus.BAD_REQUEST)
            with LOCK:
                row = q1("SELECT * FROM jobs WHERE id=?", (payload["job_id"],))
                if not row:
                    return self._send_json({"error": "job not found"}, status=HTTPStatus.NOT_FOUND)
                fields = {}
                if phase == "pre":
                    fields = {"pre_approved": 1, "pre_approved_at": utc_now()}
                else:
                    fields = {"post_approved": 1, "post_approved_at": utc_now()}
                set_job_fields(payload["job_id"], fields)
                add_timeline(payload["job_id"], f"Owner approved {phase}-change gate")
                append_audit("job_approved", owner_id=payload["owner_id"].strip(), job_id=payload["job_id"].strip(), phase=phase)
                return self._send_json({"ok": True})

        if path == "/api/requests/respond":
            if not self._owner_guard(payload):
                return
            required = ["owner_id", "request_id", "response_note"]
            missing = [x for x in required if not payload.get(x)]
            if missing:
                return self._send_json({"error": f"missing fields: {', '.join(missing)}"}, status=HTTPStatus.BAD_REQUEST)
            with LOCK:
                row = q1("SELECT * FROM requests WHERE id=?", (payload["request_id"],))
                if not row:
                    return self._send_json({"error": "request not found"}, status=HTTPStatus.NOT_FOUND)
                response_note = normalize_client_response_note(payload["response_note"], row)
                update_request(payload["request_id"], {"status": "responded", "response_note": response_note, "responded_at": utc_now()})
                append_audit(
                    "client_responded",
                    owner_id=payload["owner_id"].strip(),
                    request_id=payload["request_id"].strip(),
                    detail={"template_enforced": True},
                )
                return self._send_json({"ok": True})

        if path == "/api/settings/save":
            if not self._owner_guard(payload):
                return
            with LOCK:
                owner_id = (payload.get("owner_id") or "").strip()
                if not owner_id:
                    return self._send_json({"error": "owner_id is required"}, status=HTTPStatus.BAD_REQUEST)

                approval = (payload.get("default_approval_mode") or "").strip() or "manual_post"
                if approval not in ["auto", "manual_pre", "manual_post", "manual_both"]:
                    return self._send_json({"error": "invalid default_approval_mode"}, status=HTTPStatus.BAD_REQUEST)
                execution_mode = (payload.get("execution_mode") or "").strip() or "codex"
                if execution_mode not in ["template", "codex"]:
                    return self._send_json({"error": "invalid execution_mode"}, status=HTTPStatus.BAD_REQUEST)
                codex_model = (payload.get("codex_model") or "").strip()

                polling_enabled = 1 if bool(payload.get("polling_enabled", True)) else 0
                polling_interval = int(payload.get("polling_interval_sec", 5))
                if polling_interval not in [2, 5, 10]:
                    return self._send_json({"error": "polling_interval_sec must be one of 2,5,10"}, status=HTTPStatus.BAD_REQUEST)

                token_required = 1 if bool(payload.get("owner_token_required", False)) else 0
                token = payload.get("owner_token") or ""

                exec_sql(
                    "UPDATE owner_config SET owner_id=?, owner_token_required=?, owner_token=? WHERE id=1",
                    (owner_id, token_required, token),
                )
                set_app_setting("default_approval_mode", approval)
                set_app_setting("execution_mode", execution_mode)
                set_app_setting("codex_model", codex_model)
                set_app_setting("polling_enabled", str(polling_enabled))
                set_app_setting("polling_interval_sec", str(polling_interval))
                append_audit(
                    "settings_saved",
                    owner_id=owner_id,
                    detail={
                        "default_approval_mode": approval,
                        "execution_mode": execution_mode,
                        "codex_model": codex_model,
                        "polling_enabled": bool(polling_enabled),
                        "polling_interval_sec": polling_interval,
                    },
                )
                return self._send_json({"ok": True})

        return self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)


def main():
    global DB
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB = db_connect()
    init_db()
    seed_defaults()

    worker = threading.Thread(target=worker_loop, daemon=True)
    worker.start()

    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(("", PORT), Handler)
    print(f"Orchestrator server running at http://localhost:{PORT}")
    print(f"Storage backend: SQLite ({DB_PATH})")
    server.serve_forever()


if __name__ == "__main__":
    main()
