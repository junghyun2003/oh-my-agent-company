# oh-my-agent-company

[韩文](README.ko.md) | [英文](README.en.md) | [简体中文](README.zh-CN.md)

面向客户交付的本地多代理编排模板。

这个项目用于接收客户请求、整理任务、执行结构化流水线，并在审批闸门与审计日志支持下交付结果。

## 项目主视觉
![oh-my-agent-company project hero](assets/readme-hero.svg)

## 品牌资源
- README 主视觉 SVG: `assets/readme-hero.svg`
- GitHub 社交预览 PNG: `assets/github-social-preview.png`
- GitHub 社交预览设置位置: `Settings -> General -> Social preview`
- 重新生成预览资源: `python3 ./scripts/generate_social_preview.py`

## 为什么这个仓库适合全球协作
- 分别提供韩文、英文、简体中文 README
- 使用 MIT 许可证，便于开放协作
- 支持 `request -> assign -> execute -> QA -> report -> response` 全链路审计
- `apply_changes=true` 的任务会创建 `codex/*` 工作分支，并在 GitHub 远端上于 report 前留下 commit/push/PR 证据
- 提供健康检查与重启控制，适合安全的本地运行

## 仓库信息
- 仓库地址: `https://github.com/junghyun2003/oh-my-agent-company`
- 许可证: `MIT` (`LICENSE`)
- 主服务: `scripts/orchestrator_server.py`
- 仪表盘: `dashboard/index.html`

## 安装指南
### 0. 环境自检
```bash
bash ./scripts/setup_dev_env.sh --check-only
bash ./scripts/ci_local_check.sh --quick
```
- 运行完整验证流程前，应确保 `codex`、`node`、`npm`、`npx` 与 Playwright wrapper 可用。
- 如果要对 GitHub 目标仓库自动推送并创建 Pull Request，还需要安装 `gh`。
- 无论全局 `~/.codex/config.toml` 如何设置，Codex 运行时都会显式覆盖 `model_reasoning_effort="high"`。

### A. 仅用 Python 快速启动
```bash
python3 --version
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh status
```

### B. 基于 npm 的本地安装
如果已经安装 Node.js 和 npm:
```bash
npm install
npm run install:local
npm run bootstrap:local
```

如果 npm 不存在:
```bash
node --version
npm --version
```
先安装 Node.js LTS 和 npm，再执行 `npm install`。

## 快速开始
1. 克隆仓库并进入工作目录。
```bash
git clone https://github.com/junghyun2003/oh-my-agent-company.git
cd oh-my-agent-company
```

2. 以推荐的安全模式启动服务。
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh status
```

3. 打开仪表盘。
- 标准地址: `http://localhost:18765/dashboard/`
- 重定向别名: `http://localhost:18765/`, `http://localhost:18765/dashboard`, `http://localhost:18765/dashboard/index.html`
- 轻量模式: `http://localhost:18765/dashboard/?light=1`
- 类似 `#section-status` 的 hash 路由和最后一个激活分区在刷新后仍会保留。

4. 检查健康状态。
```bash
./scripts/infra_server_ctl.sh health
```

5. 在开发过程中安全重启。
```bash
./scripts/infra_server_ctl.sh restart
```

## 10 分钟上手
1. 选择安装路径。
```bash
# npm 路径
npm install
npm run install:local
npm run bootstrap:local

# python 路径
./scripts/infra_server_ctl.sh ensure
bash ./scripts/bootstrap_local.sh

# 强制要求 Node.js，若缺少 npm 则失败
REQUIRE_NODE=1 bash ./scripts/bootstrap_local.sh
```

2. 确认访问。
- `http://localhost:18765/dashboard/`

3. 如果失败，立即执行排查。
```bash
./scripts/infra_server_ctl.sh doctor
./scripts/infra_server_ctl.sh incident
./scripts/infra_server_ctl.sh logs 120
```

4. 运行快速自动检查。
```bash
bash ./scripts/ci_local_check.sh --quick
```

## 更新策略
- P0: 通过 `watch-start`、`ensure`、`doctor` 保持服务可用性
- P1: 优化 `system`、`light`、`dark` 主题下的 UX 质量
- P2: 通过任务卡与一眼可见状态板强化运营透明度
- 变更顺序: `policy -> code -> verification`

## 快速审阅地图
- 主说明文档: `README.zh-CN.md`
- 团队角色矩阵: `docs/TEAM_ROLE_MATRIX.md`
- 团队职责文档: `teams/AGENTS.md`, `teams/*/AGENTS.md`
- 编排蓝图: `AGENT_ORCHESTRATION.md`
- 运行时入口: `scripts/orchestrator_server.py`
- 验证工具: `python3 ./scripts/docs_sync_check.py`, `python3 ./scripts/team_policy_check.py`, `python3 ./scripts/language_policy_check.py`

## 客户运营流程
1. 请求接收: 记录原始客户请求。
2. 任务分配: 选择请求与仓库，并定义任务目标。
3. 执行流水线: `PM -> CTO -> Dev(parallel) -> Design Review -> QA -> Report`
4. 审批处理: 执行 `manual_pre`、`manual_post` 或 `manual_both` 闸门。
5. 交付响应: 发送结构化客户响应模板。
6. 审计复核: 检查 append-only 审计日志中的证据。

## 透明交付模型
- 每个客户请求都可在单一状态板中查看。
- 阶段: `Intake -> PM -> CTO -> Dev -> Design Review -> QA -> Report -> Done`
- 展示字段: `负责团队`、`阻塞问题`、`下一次更新时间`、`最近变更`
- 团队指令使用标准任务卡记录，包含 `goal`、`scope`、`acceptance`、`dependency`、`risk`、`ETA`。
- CEO、CTO 与各团队负责人决策可通过政策文档与审计日志追踪。
- 仪表盘展示最近 7 天的请求数、成功率、交付周期与失败数 KPI。

## 核心概念
- 默认启用 Local Trust Mode，本地运行无需登录
- 操作员与令牌输入默认折叠，可按需展开高级输入面板
- 基于 `allowed_actions` 与 `writable_paths` 的仓库策略约束
- 审批模式: `auto`、`manual_pre`、`manual_post`、`manual_both`
- 任务完成后追加 `post_job_audit` 的审计优先交付方式
- 实际修改仓库的任务会在 Dev 开始时创建 `codex/*` 分支，并在 report 前记录分支与 PR 结果
- 通过团队负责人体系与 Tech Leader 执行治理
- 主题模式: `system`、`light`、`dark`
- 以像素经营游戏风格展示团队状态与队列的仪表盘

## 运行命令
安全的基础设施控制脚本:
```bash
./scripts/infra_server_ctl.sh start
./scripts/infra_server_ctl.sh stop
./scripts/infra_server_ctl.sh restart
./scripts/infra_server_ctl.sh status
./scripts/infra_server_ctl.sh ensure
./scripts/infra_server_ctl.sh doctor
./scripts/infra_server_ctl.sh watch-start
./scripts/infra_server_ctl.sh watch-status
./scripts/infra_server_ctl.sh health
./scripts/infra_server_ctl.sh incident
./scripts/infra_server_ctl.sh incident-summary
./scripts/infra_server_ctl.sh logs 120
bash ./scripts/incident_notify.sh --dry-run
```
- Webhook 重试: `INCIDENT_NOTIFY_RETRY_MAX=3 INCIDENT_NOTIFY_BACKOFF_SEC=1 bash ./scripts/incident_notify.sh --webhook <url>`

macOS `launchd` 自动启动:
```bash
bash ./scripts/install_launchd_agent.sh
bash ./scripts/install_launchd_agent.sh --dry-run
bash ./scripts/uninstall_launchd_agent.sh
```

Linux `systemd` 自动启动示例:
```bash
sudo tee /etc/systemd/system/oh-my-agent-company.service >/dev/null <<'UNIT'
[Unit]
Description=oh-my-agent-company orchestrator
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/oh-my-agent-company
ExecStart=/usr/bin/python3 /path/to/oh-my-agent-company/scripts/orchestrator_server.py
Restart=always
Environment=ORCHESTRATOR_PORT=18765

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now oh-my-agent-company.service
```

Windows 任务计划程序示例:
1. Trigger: At log on
2. Action: Start a program
3. Program/script: `python`
4. Arguments: `scripts\\orchestrator_server.py`
5. Start in: `C:\\path\\to\\oh-my-agent-company`

可用性加固默认值:
- `ensure` 默认最多重试 `3` 次自动恢复，可用 `ENSURE_MAX_ATTEMPTS` 覆盖。
- 服务在被标记为健康前会先通过稳定性探针，可用 `STABILITY_PROBES` 覆盖。
- `start` 与 `ensure` 默认自动启动 watchdog，可通过 `INFRA_AUTO_WATCHDOG=0` 关闭。
- `incident` 输出标准诊断值: `OK`、`NOT_RUNNING`、`PORT_CONFLICT`、`HEALTH_FAIL`、`PID_STALE`
- 生命周期事件写入 `state/orchestrator_lifecycle.log`

npm 支持的命令:
```bash
npm run install:local
npm run bootstrap:local
npm run server:start
npm run server:status
npm run server:ensure
npm run server:watch
npm run server:health
npm run check:api
npm run check:smoke
npm run check:team-policy
npm run check:codex
npm run check:playwright:ops
npm run check:playwright:visual
npm run check:theme
npm run check:local
npm run check:local:quick
npm run ops:queue:summary
npm run ops:queue:dry-run
npm run ops:queue:apply
npm run todo:list
npm run todo:start -- 1
npm run todo:complete -- 1 --verify --commit --push
```

分步骤 TODO 执行基准:
- `TODO_TRACKER.json`
- `TODO_EXECUTION_PLAN.md`
- `todo_workflow.py complete --commit` 会把步骤状态更新与代码变更原子地放入同一次提交。

队列管理:
```bash
python3 ./scripts/ops_queue_manager.py summary
python3 ./scripts/ops_queue_manager.py apply --dry-run
python3 ./scripts/ops_queue_manager.py apply --dispatch-recovery-min 5
python3 ./scripts/ops_queue_manager.py apply --requeue-failed
```

数据库备份与恢复:
```bash
bash ./scripts/db_maintenance.sh backup
bash ./scripts/db_maintenance.sh list
bash ./scripts/db_maintenance.sh restore ./state/backups/agent_company-YYYYMMDDTHHMMSSZ.db
bash ./scripts/db_maintenance.sh prune 15
bash ./scripts/db_restore_drill.sh --dry-run
```
- `schema_version` 保存在 `state_meta` 中，用作启动迁移基线。
- 运营策略: 每天至少备份 1 次，发布前额外备份 1 次，默认保留 `15` 份，每月执行 1 次恢复演练。

队列管理 API:
```bash
curl -s http://localhost:18765/api/ops/queue | jq
curl -s http://localhost:18765/api/ops/runtime | jq
curl -s http://localhost:18765/api/ops/preflight | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"recover_stalled"}' | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"requeue_failed","job_ids":["job-123"]}' | jq

curl -s -X POST http://localhost:18765/api/ops/queue/manage \
  -H 'Content-Type: application/json' \
  -d '{"owner_id":"local-owner","action":"reprioritize","job_ids":["job-123"],"priority":"urgent"}' | jq
```
- 在运营设置页面的 `Codex Preflight` 卡片中也能查看同样的信息。
- `GET /api/ops/preflight` 包含 `node_path`、`npm_path`、`npx_path`、`playwright_wrapper_path`、`playwright_ready`、`gh_bin_path`、`codex_reasoning_effort`、`effective_codex_args`、`issues`、`remediations`。
- `GET /api/health` 包含 `worker_health`。
- `GET /api/requests`、`GET /api/jobs`、`GET /api/audit` 支持 `limit` 与 `offset`。
- 仪表盘中的请求与任务分页使用服务端 `offset` 重新拉取。
- 校验规则:
  - `action`: `recover_stalled`、`requeue_failed`、`reprioritize`
  - `job_ids`: 需要时必须为 `job-*` 格式，最多 `20` 个
  - `priority`: `urgent`、`high`、`normal`、`low`
- 每次操作都会在 `ops_queue_action_summary` 审计事件中记录 `before_counts`、`after_counts`、`delta_counts`。
- 审计 UI 支持 `kind`、`job`、`request`、`owner`、`phase` 过滤。

冒烟测试自动化:
```bash
bash ./scripts/api_contract_smoke.sh
bash ./scripts/smoke_core_flows.sh
python3 ./scripts/repo_delivery_smoke.py
bash ./scripts/runtime_recovery_smoke.sh
bash ./scripts/codex_runtime_canary.sh
bash ./scripts/playwright_ops_e2e.sh
bash ./scripts/ci_local_check.sh
```
- `api_contract_smoke.sh`: 验证核心 `/api/*` 契约
- `smoke_core_flows.sh`: 验证请求接收、任务分配、pre-approval、`job_done`、`post_job_audit`
- `repo_delivery_smoke.py`: 使用临时 git 仓库验证 `codex/*` 分支创建、commit/push 与 Pull Request 证据生成
- `runtime_recovery_smoke.sh`: 验证 `dispatching` 孤儿任务恢复与 `waiting_pre_approval` 重启后重整
- `codex_runtime_canary.sh`: 验证 `codex exec --ephemeral -s read-only -m gpt-5-codex -c model_reasoning_effort="high"` 路径
- `playwright_ops_e2e.sh`: 在真实浏览器中验证 `auto` 与 `manual_pre` 的无变更流程
- `ci_local_check.sh`: 按 `API smoke -> flow smoke -> repo delivery smoke -> runtime recovery smoke -> Codex canary -> Playwright ops E2E -> visual/theme regression` 顺序执行

Playwright 视觉回归:
```bash
bash ./scripts/visual_regression_playwright.sh
bash ./scripts/theme_regression_check.sh
```

严格模式:
```bash
STRICT_PLAYWRIGHT_VISUAL=1 bash ./scripts/visual_regression_playwright.sh
STRICT_THEME_REGRESSION=1 bash ./scripts/theme_regression_check.sh
STRICT_PLAYWRIGHT_E2E=1 bash ./scripts/playwright_ops_e2e.sh
STRICT_VISUAL_BASELINE=1 bash ./scripts/visual_regression_playwright.sh
```

`npx` 前置条件:
```bash
node --version
npm --version
npm install -g @playwright/cli@latest
playwright-cli --help
```
- 基线截图保存在 `output/playwright/baseline/*`
- 最近运行结果保存在 `output/playwright/current/*`

直接运行的兜底方式:
```bash
python3 scripts/orchestrator_server.py
```

更换端口运行:
```bash
ORCHESTRATOR_PORT=19090 python3 scripts/orchestrator_server.py
```

Tech Leader 审计:
```bash
./scripts/tech_leader_audit.sh
python3 ./scripts/docs_sync_check.py
python3 ./scripts/team_policy_check.py
python3 ./scripts/kpi_weekly_report.py --dry-run
python3 ./scripts/kpi_weekly_report.py --days 7 --output ./reports/kpi/weekly-kpi.json
python3 ./scripts/kpi_weekly_report.py --days 7 --save-latest --save-history
bash ./scripts/security_scan.sh --dry-run
python3 ./scripts/language_policy_check.py
```
- 可通过 `.security_scan_allowlist` 以 substring 形式添加误报排除项。

推送前强制校验:
```bash
bash ./scripts/install_pre_push_hook.sh
bash ./scripts/install_pre_commit_hook.sh
```
- 安装后的 hook 会在每次推送前执行 `python3 ./scripts/docs_sync_check.py`、`python3 ./scripts/team_policy_check.py`、`python3 ./scripts/language_policy_check.py` 与 `bash ./scripts/smoke_core_flows.sh`。
- 当政策文档与运行时行为不同步时，推送会被阻止。

内置停滞任务恢复:
- 编排器会按轮询周期检查停滞任务。
- 启动时会把 `dispatching`、`in_progress`、`waiting_pre_approval`、`waiting_post_approval` 视为孤儿任务并自动重整。
- `dispatching` 状态会依据默认 `5` 分钟的 `dispatch_recovery_min` 阈值快速重新入队。
- 在变更应用前中断的任务会以相同 job ID 重新入队；在可能已应用变更的阶段中断的任务可能被标记为 `failed(orchestrator_restart_recovery)`，等待人工重新分配。
- 应用设置键: `queue_warn_min`、`dispatch_recovery_min`、`in_progress_timeout_min`、`ops_recovery_poll_sec`、`worker_concurrency`

## 数据与产物
- 数据库: `state/agent_company.db`
- 请求表: `requests`
- 任务表: `jobs`
- 代理状态表: `agent_status`
- 审计表: `audit_events`
- 交付产物: `deliverables/`
- `state/*.log`、`state/*.pid`、`state/backups/*` 等运行时状态产物被视为易变数据，不纳入 git 跟踪。

## 团队与治理文档
- 文档索引: `docs/INDEX.md`
- 10 分钟上手文档: `docs/ONBOARDING_10MIN.md`
- 公司政策: `AGENTS.md`
- 团队角色矩阵: `docs/TEAM_ROLE_MATRIX.md`
- 团队索引: `teams/AGENTS.md`
- 团队文档: `teams/*/AGENTS.md`
- 编排蓝图: `AGENT_ORCHESTRATION.md`
- 组件治理: `COMPONENT_REGISTRY.md`
- 主题政策: `teams/design-ops/THEME_POLICY.md`
- 语言政策: `teams/design-ops/LANGUAGE_POLICY.md`
- 提交/推送规范: `COMMIT_PUSH_RULES.md`
- 营销指南: `MARKETING_PLAYBOOK.md`
- 治理证据包: `GOVERNANCE_SOURCES_2026-02-21.md`

## 开源协作
- 贡献方式: `CONTRIBUTING.md`
- 安全报告: `SECURITY.md`
- CI 工作流: `.github/workflows/ci.yml`
- Fork 政策: `FORK_CUSTOMIZATION_POLICY.md`
- 上游基线: `UPSTREAM_BASELINE.env`
- 自定义变更日志: `CUSTOMIZATION_LOG.md`

## Fork 用户: 区分原始内容与自定义内容
1. 在 `UPSTREAM_BASELINE.env` 中设置基线。
2. 在 `CUSTOMIZATION_LOG.md` 中记录自定义变更。
3. 使用提交页脚:
   - `Change-Origin: upstream|custom`
   - `Upstream-Ref: <tag-or-sha-or-none>`
4. 发布前生成差异报告。
```bash
./scripts/fork_diff_report.sh
./scripts/fork_diff_report.sh --save
```
- 保存路径: `reports/fork/customization-report-<UTC>.md`
- 即使 `UPSTREAM_REF` 为空，报告也会按 `upstream branch -> origin/main -> origin/master -> latest tag -> root commit` 回退链生成。

## 故障排查
- 浏览器无法连接时:
  - `./scripts/infra_server_ctl.sh status`
  - `./scripts/infra_server_ctl.sh ensure`
  - `./scripts/infra_server_ctl.sh doctor`
  - `./scripts/infra_server_ctl.sh restart`
  - `./scripts/infra_server_ctl.sh logs 120`
- 请求或任务分配 API 返回 `403` 时:
  - 如果启用了 strict owner mode，请检查 `owner_id` 是否不匹配。
  - 如果启用了 token mode，请提供 `owner_token`。
- 端口冲突:
  - 停止冲突进程后重新启动服务。
- 策略错误:
  - 检查数据库中的 `repo_policies` 与 `app_settings`。

## 给客户的说明
这个仓库在 CEO、CTO、各团队负责人以及透明执行审计机制的推动下持续快速演进。
可读性、上手体验与运营可信度都被视为产品级要求。
