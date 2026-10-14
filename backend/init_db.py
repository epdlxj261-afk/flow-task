"""tasks·users·sessions 테이블을 만든다. 실행: python -m backend.init_db

이미 있는 테이블은 지우지 않고, 없는 테이블만 만든다.
T18: 예전에 만든 tasks 테이블에 user_id 열이 없으면 열만 추가한다. 기존 행은 user_id NULL로 그대로 남는다.
여러 번 실행해도 결과가 같다.
"""

from sqlalchemy import inspect, text

from backend.database import Base, engine
from backend import models  # noqa: F401  테이블 정의를 Base에 등록한다.


def add_tasks_user_id() -> bool:
    """tasks.user_id가 없으면 추가하고 True를 돌려준다."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "user_id" in columns:
        return False
    # 열·인덱스·외래 키 이름은 새로 만드는 테이블(SQLAlchemy 기본 이름)과 같게 맞춘다.
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE tasks"
                " ADD COLUMN user_id INT NULL AFTER id,"
                " ADD INDEX ix_tasks_user_id (user_id),"
                " ADD CONSTRAINT tasks_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE"
            )
        )
    return True


def main() -> None:
    existing = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine, checkfirst=True)

    for table_name in Base.metadata.tables:
        if table_name in existing:
            print(f"{table_name}: 이미 있습니다. 변경하지 않았습니다.")
        else:
            print(f"{table_name}: 새로 만들었습니다.")

    if add_tasks_user_id():
        print("tasks.user_id: 열을 추가했습니다. 기존 행은 NULL(어느 사용자에게도 속하지 않음)입니다.")
    else:
        print("tasks.user_id: 이미 있습니다. 변경하지 않았습니다.")


if __name__ == "__main__":
    main()
