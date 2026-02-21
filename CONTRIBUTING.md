# Contributing Guide

Thank you for contributing to `oh-my-agent-company`.

## Scope
- Improve reliability, usability, transparency, and delivery quality.
- Keep changes aligned with company/team policy docs.

## Workflow
1. Open an issue (or describe problem clearly in PR)
2. Propose a minimal, testable change
3. Include evidence (before/after behavior, logs, screenshots when relevant)
4. Keep docs updated with code changes

## Pull Request Checklist
- [ ] Code change is scoped and reversible
- [ ] Relevant docs updated (`AGENTS.md`, `README.md`, team docs)
- [ ] No policy-violating file/path changes
- [ ] Approval flow impact described
- [ ] Audit/operational impact described

## Commit Style
- Prefer concise conventional-style messages
- Example: `feat(infra): add safe restart guard`
- Team rulebook: `/Users/junghyen2003/Documents/oh-my-agent-company/COMMIT_PUSH_RULES.md`
- For forked repositories, include provenance footers:
  - `Change-Origin: upstream|custom`
  - `Upstream-Ref: <tag-or-sha-or-none>`

## Fork Provenance
- Maintain baseline metadata in `/Users/junghyen2003/Documents/oh-my-agent-company/UPSTREAM_BASELINE.env`
- Record custom-only changes in `/Users/junghyen2003/Documents/oh-my-agent-company/CUSTOMIZATION_LOG.md`
- Use `/Users/junghyen2003/Documents/oh-my-agent-company/scripts/fork_diff_report.sh` before release

## Code of Collaboration
- Be direct, specific, and respectful
- Prioritize reproducible evidence over assumptions
