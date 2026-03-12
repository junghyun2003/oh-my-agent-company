# 10-Minute Onboarding

로컬 첫 설치 사용자를 위한 권장 경로입니다. 처음에는 서버 기동과 대시보드 진입까지만 확인해도 충분합니다.

## 1) 준비 확인 (1분)
```bash
bash ./scripts/setup_dev_env.sh --check-only
bash ./scripts/ci_local_check.sh --quick
```
- `setup_dev_env.sh --check-only`는 `core required`와 `advanced optional`을 나눠 보여줍니다.
- `ci_local_check.sh --quick`는 비파괴 점검이며 샘플 request/job/audit를 만들지 않습니다.

## 2) 서버 기동 (2분)
```bash
bash ./scripts/infra_server_ctl.sh ensure
bash ./scripts/infra_server_ctl.sh status
```

## 3) 대시보드 접속 (1분)
- `http://localhost:18765/dashboard/`
- 첫 화면의 `시작하기` 섹션에서 서버 상태, 필수 도구, 첫 요청, 첫 작업 순서를 바로 볼 수 있습니다.

## 4) 첫 요청과 첫 작업 (4분)
- 요청 접수: `클라이언트명`, `원본 요청`만 먼저 입력합니다.
- 작업 할당: 기본적으로 현재 workspace가 대상입니다. 외부 저장소는 정책 설정 후 목록에 나타납니다.

## 5) 고급 점검이 필요할 때만 실행 (2분)
```bash
bash ./scripts/bootstrap_local.sh --with-smoke
bash ./scripts/smoke_core_flows.sh
```
- 주의: 위 명령은 샘플 request/job/audit 데이터를 생성할 수 있습니다.

## 6) 운영 점검 (2분)
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
