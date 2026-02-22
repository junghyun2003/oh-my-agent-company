# 10-Minute Onboarding

## 1) 준비 확인 (1분)
```bash
bash ./scripts/setup_dev_env.sh --check-only
```

## 2) 서버 기동 (2분)
```bash
bash ./scripts/infra_server_ctl.sh ensure
bash ./scripts/infra_server_ctl.sh status
```

## 3) 대시보드 접속 (1분)
- `http://localhost:18765/dashboard/`

## 4) 핵심 플로우 점검 (4분)
```bash
bash ./scripts/smoke_core_flows.sh
```

## 5) 운영 점검 (2분)
```bash
python3 ./scripts/docs_sync_check.py
bash ./scripts/security_scan.sh --dry-run
bash ./scripts/infra_server_ctl.sh incident-summary
```

## 실패 시
```bash
bash ./scripts/infra_server_ctl.sh doctor
bash ./scripts/infra_server_ctl.sh logs 120
```
