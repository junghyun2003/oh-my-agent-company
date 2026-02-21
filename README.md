# oh-my-agent-company

Local multi-agent orchestration template for client delivery.

This project receives client requests, refines work, runs a structured pipeline,
and delivers auditable outcomes with approval gates.

## Why This Repo Is Global-Ready
- Bilingual operation context (Korean-first, globally understandable structure)
- MIT license for open collaboration
- End-to-end auditable workflow (`request -> assign -> execute -> QA -> report -> response`)
- Safe local operation with health checks and restart controls

## Repository Information
- Repository: `https://github.com/junghyun2003/oh-my-agent-company`
- License: `MIT` (`/Users/junghyen2003/Documents/oh-my-agent-company/LICENSE`)
- Main server: `/Users/junghyen2003/Documents/oh-my-agent-company/scripts/orchestrator_server.py`
- Dashboard: `/Users/junghyen2003/Documents/oh-my-agent-company/dashboard/index.html`

## Quick Start (Sequential)
Follow these steps in order.

1. Clone and enter workspace
```bash
git clone https://github.com/junghyun2003/oh-my-agent-company.git
cd oh-my-agent-company
```

2. Start server (recommended safe mode)
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh status
```

3. Open dashboard
- `http://localhost:18765/`
- `http://localhost:18765/dashboard/`

4. Verify health
```bash
./scripts/infra_server_ctl.sh health
```

5. Restart safely during development
```bash
./scripts/infra_server_ctl.sh restart
```

## Client Operation Flow (Sequential)
1. Request intake: register raw client request
2. Work assignment: select request/repository, define mission and refined instruction
3. Pipeline execution: `PM -> CTO -> Dev(parallel) -> QA -> Report`
4. Approval handling: process `manual_pre/manual_post/manual_both` gates
5. Delivery response: send structured response template
6. Audit review: validate evidence in append-only audit logs

## Core Concepts
- Owner identity verification for write APIs
- Repository policy enforcement (`allowed_actions`, `writable_paths`)
- Approval modes: `auto`, `manual_pre`, `manual_post`, `manual_both`
- Audit-first delivery with post-completion audit event
- Team leads (non C-level) and Tech Leader for policy/tech governance

## Runtime Commands
Safe infra control script:
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh stop
./scripts/infra_server_ctl.sh restart
./scripts/infra_server_ctl.sh status
./scripts/infra_server_ctl.sh health
./scripts/infra_server_ctl.sh logs 120
```

Direct run (fallback):
```bash
python3 scripts/orchestrator_server.py
```

Change port:
```bash
ORCHESTRATOR_PORT=19090 python3 scripts/orchestrator_server.py
```

## Data and Artifacts
- DB: `/Users/junghyen2003/Documents/oh-my-agent-company/state/agent_company.db`
- Requests table: `requests`
- Jobs table: `jobs`
- Agent status table: `agent_status`
- Audit table: `audit_events`
- Deliverables: `/Users/junghyen2003/Documents/oh-my-agent-company/deliverables/`

## Team and Governance Docs
- Company policy: `/Users/junghyen2003/Documents/oh-my-agent-company/AGENTS.md`
- Team index: `/Users/junghyen2003/Documents/oh-my-agent-company/teams/AGENTS.md`
- Team docs: `/Users/junghyen2003/Documents/oh-my-agent-company/teams/*/AGENTS.md`
- Component governance: `/Users/junghyen2003/Documents/oh-my-agent-company/COMPONENT_REGISTRY.md`
- Marketing guide: `/Users/junghyen2003/Documents/oh-my-agent-company/MARKETING_PLAYBOOK.md`

## Open Source Collaboration
- How to contribute: `/Users/junghyen2003/Documents/oh-my-agent-company/CONTRIBUTING.md`
- Security reporting: `/Users/junghyen2003/Documents/oh-my-agent-company/SECURITY.md`

## Troubleshooting
- Browser cannot connect:
  - `./scripts/infra_server_ctl.sh status`
  - `./scripts/infra_server_ctl.sh restart`
  - `./scripts/infra_server_ctl.sh logs 120`
- Port conflict:
  - stop conflicting process and restart server
- Policy errors:
  - inspect `repo_policies` and `app_settings` in DB

## Notes for Clients
This repository is evolving rapidly with CEO/CTO leadership, team leads,
and transparent execution audits. Global readability and onboarding are treated
as first-class product requirements.
