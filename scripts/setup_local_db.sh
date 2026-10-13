#!/usr/bin/env bash
# T09: 로컬 MariaDB에 Task Flow 전용 DB와 사용자를 만들고 .env를 작성한다.
# - DB 관리자 권한이 필요하므로 sudo로 mariadb에 접속한다.
# - 비밀번호는 무작위로 만들어 .env에만 저장하고 화면에 출력하지 않는다.
# - 이미 .env나 같은 이름의 사용자가 있으면 덮어쓰지 않고 멈춘다.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=task_flow
DB_USER=task_flow_app

if [ -e .env ]; then
  echo "오류: .env가 이미 있습니다. 기존 설정을 보호하기 위해 덮어쓰지 않고 종료합니다." >&2
  exit 1
fi

echo "1/4 기존 사용자를 확인합니다. (sudo 비밀번호를 물으면 입력하세요)"
existing=$(sudo mariadb -N -e "SELECT CONCAT(user, '@', host) FROM mysql.user WHERE user = '${DB_USER}';")
if [ -n "${existing}" ]; then
  echo "오류: 같은 이름의 DB 사용자가 이미 있습니다. 기존 계정을 바꾸지 않고 종료합니다." >&2
  echo "${existing}" | sed 's/^/  - /' >&2
  exit 1
fi

DB_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
# MariaDB는 SQL 실행 오류 시 문장 전체를 출력하므로, SQL에는 평문 대신 mysql_native_password 해시를 넣는다.
DB_PASSWORD_HASH=$(DB_PASSWORD="${DB_PASSWORD}" python3 -c '
import hashlib, os
password = os.environ["DB_PASSWORD"].encode()
print("*" + hashlib.sha1(hashlib.sha1(password).digest()).hexdigest().upper())
')

echo "2/4 DB와 전용 사용자를 만듭니다."
sudo mariadb <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY PASSWORD '${DB_PASSWORD_HASH}';
CREATE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY PASSWORD '${DB_PASSWORD_HASH}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
SQL

echo "3/4 .env를 작성합니다. (본인만 읽을 수 있게 권한 600)"
(
  umask 077
  cat > .env <<ENV
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
ENV
)

echo "4/4 전용 사용자로 접속을 확인합니다."
MYSQL_PWD="${DB_PASSWORD}" mariadb -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${DB_NAME}" \
  -e "SELECT CURRENT_USER() AS user, DATABASE() AS db, @@character_set_database AS charset;"

echo "완료: ${DB_NAME} DB와 ${DB_USER} 사용자를 만들고 .env를 작성했습니다."
