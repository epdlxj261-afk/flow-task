"""MariaDB 연결 설정. 접속 정보는 프로젝트 루트의 .env(또는 환경변수)에서 읽는다."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# 이미 설정된 환경변수(예: systemd에서 넣은 값)가 있으면 .env보다 우선한다.
load_dotenv(PROJECT_ROOT / ".env", override=False)

REQUIRED_SETTINGS = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]


def get_database_url() -> URL:
    missing = [name for name in REQUIRED_SETTINGS if not os.environ.get(name)]
    if missing:
        raise RuntimeError(
            f"DB 접속 설정이 없습니다: {', '.join(missing)}. "
            ".env.example을 참고해 .env를 준비하세요."
        )
    # URL.create는 비밀번호의 특수문자를 알아서 처리하고, repr에서 비밀번호를 가린다.
    return URL.create(
        "mariadb+pymysql",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


# pool_pre_ping: DB가 재시작되어 끊긴 연결을 사용 전에 확인하고 새로 연결한다.
engine = create_engine(get_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
