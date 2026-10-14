"""DB 테이블 정의. 필드 규칙은 API-SPEC.md의 Task·User를 따른다."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class TaskRecord(Base):
    __tablename__ = "tasks"
    __table_args__ = {"mariadb_charset": "utf8mb4"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # T18: 할 일의 주인. 다중 사용자 전환 전 할 일은 NULL로 남아 어느 사용자에게도 보이지 않는다.
    # 기존 테이블에는 init_db가 ALTER TABLE로 추가한다.
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # utf8mb4의 VARCHAR 길이는 바이트가 아닌 문자 수이므로 API의 글자 수 규칙과 같다.
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"),
        nullable=False,
        default="TODO",
        server_default="TODO",
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"),
        nullable=False,
        default="NORMAL",
        server_default="NORMAL",
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 시간대 정보 없이 UTC 시각을 저장한다. 값은 API가 넣는다.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class UserRecord(Base):
    __tablename__ = "users"
    __table_args__ = {"mariadb_charset": "utf8mb4"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # API가 영문 소문자·숫자·밑줄만 받으므로 DB 비교 규칙(대소문자 무시)과 관계없이 중복 판단이 같다.
    username: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    # 원문 비밀번호는 저장하지 않는다. argon2id 해시 문자열(약 100자)을 저장한다.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SessionRecord(Base):
    """로그인 세션. 쿠키에 넣은 무작위 토큰의 SHA-256 해시만 저장해, DB 값만으로는 로그인할 수 없게 한다."""

    __tablename__ = "sessions"
    __table_args__ = {"mariadb_charset": "utf8mb4"}

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
