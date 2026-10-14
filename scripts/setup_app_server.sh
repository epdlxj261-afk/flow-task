#!/usr/bin/env bash
# T13: App 서버에 Task Flow API를 가상환경과 systemd 서비스로 설치한다.
# - 코드는 미리 /opt/task-flow에 받아 둔다. (예: sudo git clone <저장소 주소> /opt/task-flow)
# - 실행: sudo /opt/task-flow/scripts/setup_app_server.sh
# - DB 접속 정보는 /etc/task-flow/api.env에 둔다. 이미 있으면 덮어쓰지 않는다.
# - 다시 실행해도 기존 사용자·가상환경·환경변수 파일은 유지하고, 패키지·DB 테이블·서비스만 갱신한다.
#   코드 갱신 후 재배포: sudo git -C /opt/task-flow pull --ff-only && sudo /opt/task-flow/scripts/setup_app_server.sh
set -euo pipefail

APP_DIR=/opt/task-flow
APP_USER=taskflow
ENV_DIR=/etc/task-flow
ENV_FILE="${ENV_DIR}/api.env"
SERVICE=task-flow-api

if [ "$(id -u)" -ne 0 ]; then
  echo "오류: sudo로 실행하세요." >&2
  exit 1
fi

if [ "$(cd "$(dirname "$0")/.." && pwd)" != "${APP_DIR}" ]; then
  echo "오류: 코드가 ${APP_DIR}에 있어야 합니다. (systemd 서비스 파일이 이 경로를 사용)" >&2
  exit 1
fi
cd "${APP_DIR}"

echo "1/6 서비스 전용 사용자(${APP_USER})를 확인합니다."
if id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "  이미 있습니다."
else
  useradd --system --no-create-home --shell /usr/sbin/nologin "${APP_USER}"
  echo "  새로 만들었습니다."
fi

echo "2/6 가상환경에 패키지를 설치합니다."
if [ ! -x .venv/bin/python ]; then
  # Ubuntu에서 실패하면 python3-venv 패키지를 먼저 설치한다.
  python3 -m venv .venv
fi
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

echo "3/6 환경변수 파일(${ENV_FILE})을 확인합니다."
if [ ! -e "${ENV_FILE}" ]; then
  # root만 수정하고 서비스 사용자는 읽기만 할 수 있게 한다.
  install -d -m 750 -o root -g "${APP_USER}" "${ENV_DIR}"
  install -m 640 -o root -g "${APP_USER}" .env.example "${ENV_FILE}"
  echo "  .env.example을 복사했습니다. DB 서버 주소와 비밀번호를 입력한 뒤 다시 실행하세요:"
  echo "  sudo nano ${ENV_FILE}"
  exit 0
fi
if grep -q '^DB_PASSWORD=change-me$' "${ENV_FILE}"; then
  echo "오류: ${ENV_FILE}의 DB_PASSWORD가 예시 값입니다. 실제 값으로 바꾼 뒤 다시 실행하세요." >&2
  exit 1
fi

echo "4/6 DB 테이블을 확인합니다. (없는 테이블·열만 추가하고 기존 데이터는 지우지 않음)"
# 접속 정보는 명령줄 인자가 아닌 환경변수로 넘겨 프로세스 목록에 보이지 않게 한다. 서비스와 같은 사용자로 실행한다.
(
  set -a
  # shellcheck source=/dev/null
  . "${ENV_FILE}"
  set +a
  PYTHONDONTWRITEBYTECODE=1 runuser -u "${APP_USER}" -- .venv/bin/python -m backend.init_db
) | sed 's/^/  /'

echo "5/6 systemd 서비스(${SERVICE})를 설치하고 시작합니다."
install -m 644 "deploy/${SERVICE}.service" "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable "${SERVICE}"
systemctl restart "${SERVICE}"

echo "6/6 /api/health 응답과 DB 연결을 확인합니다."
for _ in $(seq 1 20); do
  if curl -fsS -m 2 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "  /api/health: $(curl -sS -m 2 http://127.0.0.1:8000/api/health)"
    # 할 일 API는 로그인이 필요하므로(T18), 없는 세션 쿠키로 /api/auth/me를 불러 DB 조회까지 확인한다.
    # DB에서 세션을 찾지 못하면 401(정상), DB에 접속할 수 없으면 503이다.
    # DB 접속 대기(PyMySQL 기본 10초)보다 길게 기다려야 503 응답까지 볼 수 있다.
    db_code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -b 'task_flow_session=deploy-check' http://127.0.0.1:8000/api/auth/me || true)
    echo "  DB 확인(/api/auth/me, 없는 세션): HTTP ${db_code} (401이면 정상)"
    if [ "${db_code}" != "401" ]; then
      echo "오류: 서비스는 실행 중이지만 DB 조회에 실패했습니다. (503·000이면 api.env의 DB_HOST 등과 DB 서버 3306 방화벽을 확인)" >&2
      echo "  로그: sudo journalctl -u ${SERVICE} -n 50" >&2
      exit 1
    fi
    echo "완료: ${SERVICE} 서비스가 실행 중이며 부팅 시 자동 시작됩니다."
    exit 0
  fi
  sleep 0.5
done
echo "오류: 10초 안에 응답이 없습니다. 로그를 확인하세요: sudo journalctl -u ${SERVICE} -n 50" >&2
exit 1
