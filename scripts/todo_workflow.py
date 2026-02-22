#!/usr/bin/env python3
import argparse
import json
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "TODO_TRACKER.json"


def run(cmd: str, check: bool = True) -> int:
    print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=str(ROOT))
    if check and result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {cmd}")
    return result.returncode


def load_tracker() -> dict:
    return json.loads(TRACKER.read_text(encoding="utf-8"))


def save_tracker(data: dict) -> None:
    TRACKER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_step(data: dict, step_id: int) -> dict:
    for step in data.get("steps", []):
        if int(step.get("id", 0)) == step_id:
            return step
    raise ValueError(f"step not found: {step_id}")


def cmd_list(_args: argparse.Namespace) -> None:
    data = load_tracker()
    for step in data.get("steps", []):
        print(f"[{step['status']}] step {step['id']}: {step['title']}")


def cmd_start(args: argparse.Namespace) -> None:
    data = load_tracker()
    current = None
    for step in data.get("steps", []):
        if step.get("status") == "in_progress":
            current = step["id"]
            break
    if current is not None and current != args.step_id:
        raise RuntimeError(f"another step is already in progress: {current}")

    step = find_step(data, args.step_id)
    if step.get("status") == "done":
        raise RuntimeError(f"step already done: {args.step_id}")

    step["status"] = "in_progress"
    save_tracker(data)
    print(f"step {args.step_id} -> in_progress")


def build_commit_message(step: dict) -> str:
    commit_type = step.get("commit_type", "chore")
    scope = step.get("scope", "ops")
    summary = step.get("summary", step.get("title", "todo step update")).strip()
    title = f"{commit_type}({scope}): {summary}"
    return title


def cmd_complete(args: argparse.Namespace) -> None:
    data = load_tracker()
    step = find_step(data, args.step_id)
    if step.get("status") == "done":
        print(f"step {args.step_id} already done")
        return

    if args.verify:
        for cmd in step.get("verify", []):
            run(cmd, check=True)

    original_status = step.get("status")
    if args.commit:
        files = step.get("files", [])
        if not files:
            raise RuntimeError("step has no file list; cannot commit safely")
        step["status"] = "done"
        save_tracker(data)
        tracked_files = list(dict.fromkeys(files + [str(TRACKER.relative_to(ROOT))]))
        quoted = " ".join(shlex.quote(p) for p in tracked_files)
        try:
            run(f"git add {quoted}", check=True)
            message = build_commit_message(step)
            run(
                "git commit "
                + f"-m \"{message}\" "
                + "-m \"Change-Origin: custom\" "
                + "-m \"Upstream-Ref: none\"",
                check=True,
            )
            if args.push:
                run("git push origin main", check=True)
        except Exception:
            step["status"] = original_status
            save_tracker(data)
            raise
    else:
        step["status"] = "done"
        save_tracker(data)
    print(f"step {args.step_id} -> done")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Step-by-step TODO workflow manager")
    sub = p.add_subparsers(dest="cmd", required=True)

    l = sub.add_parser("list", help="list steps")
    l.set_defaults(func=cmd_list)

    s = sub.add_parser("start", help="mark a step in progress")
    s.add_argument("step_id", type=int)
    s.set_defaults(func=cmd_start)

    c = sub.add_parser("complete", help="verify and complete a step")
    c.add_argument("step_id", type=int)
    c.add_argument("--verify", action="store_true", help="run verification commands")
    c.add_argument("--commit", action="store_true", help="commit step files")
    c.add_argument("--push", action="store_true", help="push after commit")
    c.set_defaults(func=cmd_complete)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
