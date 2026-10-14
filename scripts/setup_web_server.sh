#!/usr/bin/env bash
# T14: Web 서버에 Nginx 설정과 화면 파일을 설치한다.
# - 실행: sudo ./scripts/setup_web_server.sh [App주소:포트]  (기본값 127.0.0.1:8000, 같은 서버의 App 서비스)
#   예) App 서버가 따로 있으면 sudo ./scripts/setup_web_server.sh 10.0.1.20:8000
# - 화면 파일은 /var/www/task-flow에 복사한다. 이 폴더만 새 내용으로 바꾼다.
# - Nginx 기본 사이트는 sites-enabled의 링크만 해제한다(sites-available 원본은 남는다).
# - 설정 검사(nginx -t)에 실패하면 이전 설정으로 되돌리고 멈춘다.
set -euo pipefail

APP_ADDRESS="${1:-127.0.0.1:8000}"
WEB_ROOT=/var/www/task-flow
SITE=task-flow
SITE_FILE="/etc/nginx/sites-available/${SITE}"

if [ "$(id -u)" -ne 0 ]; then
  echo "오류: sudo로 실행하세요." >&2
  exit 1
fi
if ! [[ "${APP_ADDRESS}" =~ ^[A-Za-z0-9.-]+:[0-9]+$ ]]; then
  echo "오류: App 주소는 '호스트:포트' 형식이어야 합니다. (예: 10.0.1.20:8000)" >&2
  exit 1
fi
command -v nginx >/dev/null || { echo "오류: nginx가 없습니다. sudo apt install -y nginx" >&2; exit 1; }

cd "$(dirname "$0")/.."

echo "1/5 App 서버(${APP_ADDRESS}) 응답을 확인합니다."
# App을 막 재시작했다면 뜨는 데 1~2초 걸리므로 최대 10초 기다린다.
app_ok=no
for _ in $(seq 1 20); do
  if curl -fsS -m 2 "http://${APP_ADDRESS}/api/health" >/dev/null 2>&1; then
    app_ok=yes
    break
  fi
  sleep 0.5
done
if [ "${app_ok}" = yes ]; then
  echo "  /api/health 정상"
else
  echo "  경고: 응답이 없습니다. 설치는 계속하지만 App 서비스와 방화벽(8000)을 확인하세요." >&2
fi

echo "2/5 화면 파일을 ${WEB_ROOT}에 복사합니다."
new_root=$(mktemp -d /var/www/.task-flow-new.XXXXXX)
install -m 644 frontend/index.html frontend/styles.css frontend/app.js "${new_root}/"
chmod 755 "${new_root}"
rm -rf "${WEB_ROOT}.old"
[ -d "${WEB_ROOT}" ] && mv "${WEB_ROOT}" "${WEB_ROOT}.old"
mv "${new_root}" "${WEB_ROOT}"
rm -rf "${WEB_ROOT}.old"

echo "3/5 Nginx 설정을 설치합니다."
backup=""
if [ -e "${SITE_FILE}" ]; then
  backup=$(mktemp)
  cp "${SITE_FILE}" "${backup}"
fi
sed "s#APP_ADDRESS#${APP_ADDRESS}#" deploy/nginx/task-flow.conf > "${SITE_FILE}"
chmod 644 "${SITE_FILE}"
ln -sfn "${SITE_FILE}" "/etc/nginx/sites-enabled/${SITE}"
default_was_enabled=no
if [ -L /etc/nginx/sites-enabled/default ]; then
  default_was_enabled=yes
  rm /etc/nginx/sites-enabled/default
  echo "  기본 사이트 링크를 해제했습니다. (복구: sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/)"
fi

echo "4/5 설정을 검사하고 적용합니다."
if ! nginx -t; then
  echo "오류: 설정 검사 실패. 이전 상태로 되돌립니다." >&2
  if [ -n "${backup}" ]; then
    cp "${backup}" "${SITE_FILE}"
  else
    rm -f "/etc/nginx/sites-enabled/${SITE}" "${SITE_FILE}"
  fi
  [ "${default_was_enabled}" = yes ] && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  exit 1
fi
[ -n "${backup}" ] && rm -f "${backup}"
systemctl enable nginx >/dev/null 2>&1
systemctl reload nginx

echo "5/5 Web 주소로 응답을 확인합니다."
# reload는 기다리지 않고 끝나므로, 이전 설정의 프로세스가 잠시 응답할 수 있다. 화면이 새 파일로 바뀔 때까지 기다린다.
for _ in $(seq 1 20); do
  if curl -s -m 5 http://127.0.0.1/ 2>/dev/null | cmp -s - "${WEB_ROOT}/index.html"; then
    break
  fi
  sleep 0.5
done
if curl -s -m 5 http://127.0.0.1/ 2>/dev/null | cmp -s - "${WEB_ROOT}/index.html"; then
  echo "  /: Task Flow 화면"
else
  echo "오류: 10초가 지나도 / 가 Task Flow 화면이 아닙니다. sudo nginx -T로 다른 server 설정을 확인하세요." >&2
  exit 1
fi
tasks_code=$(curl -s -m 35 -o /dev/null -w '%{http_code}' http://127.0.0.1/api/tasks || true)
echo "  /api/tasks: HTTP ${tasks_code}"
if [ "${tasks_code}" != "200" ]; then
  echo "오류: Nginx는 적용됐지만 /api/tasks가 실패했습니다. (502: App 연결 실패, 503: App의 DB 연결 실패)" >&2
  echo "  로그: sudo tail -n 20 /var/log/nginx/error.log" >&2
  exit 1
fi
echo "완료: http://<Web 서버 주소>/ 에서 화면과 /api를 함께 사용할 수 있습니다."
