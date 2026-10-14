"""tasks·users 테이블을 만든다. 실행: python -m backend.init_db

이미 있는 테이블은 지우거나 바꾸지 않고, 없는 테이블만 만든다.
"""

from sqlalchemy import inspect

from backend.database import Base, engine
from backend import models  # noqa: F401  테이블 정의를 Base에 등록한다.


def main() -> None:
    existing = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine, checkfirst=True)

    for table_name in Base.metadata.tables:
        if table_name in existing:
            print(f"{table_name}: 이미 있습니다. 변경하지 않았습니다.")
        else:
            print(f"{table_name}: 새로 만들었습니다.")


if __name__ == "__main__":
    main()
