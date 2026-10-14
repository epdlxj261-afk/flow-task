"""API 요청·응답 형식과 입력 규칙. 규칙은 API-SPEC.md를 따른다."""

import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints, field_validator

Status = Literal["TODO", "DOING", "DONE"]
Priority = Literal["HIGH", "NORMAL", "LOW"]

# 글자 수는 Python len(코드 포인트) 기준이며 프런트엔드 Array.from(text).length와 같다.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_due_date(value: str) -> str:
    # date.fromisoformat은 20261013 같은 형식도 받으므로 YYYY-MM-DD 형식을 먼저 확인한다.
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError("due_date must be YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("due_date must be a valid calendar date") from None
    return value


DueDate = Annotated[str, AfterValidator(validate_due_date)]

# 아이디는 영문 소문자·숫자·밑줄 4~20자. 비밀번호는 앞뒤 공백도 그대로 두고 8~128자.
Username = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{4,20}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class TaskCreate(BaseModel):
    # 알 수 없는 필드(id, status, created_at 포함)는 거절하고, 타입 자동 변환(숫자→문자 등)은 하지 않는다.
    model_config = ConfigDict(extra="forbid", strict=True)

    title: Title
    description: Description = ""
    priority: Priority = "NORMAL"
    due_date: DueDate | None = None


class TaskUpdate(BaseModel):
    """부분 수정 요청. 보낸 필드만 바꾸며, 보냈는지는 model_fields_set으로 구분한다."""

    model_config = ConfigDict(extra="forbid", strict=True)

    title: Title | None = None
    description: Description | None = None
    status: Status | None = None
    priority: Priority | None = None
    # due_date만 null을 허용한다. null을 보내면 마감일을 지운다.
    due_date: DueDate | None = None

    @field_validator("title", "description", "status", "priority", mode="before")
    @classmethod
    def reject_null(cls, value: object) -> object:
        # 기본값 None은 검사하지 않으므로, 이 검사는 클라이언트가 null을 직접 보낸 경우에만 동작한다.
        if value is None:
            raise ValueError("null is not allowed")
        return value


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: datetime


class Credentials(BaseModel):
    """회원가입·로그인 요청."""

    model_config = ConfigDict(extra="forbid", strict=True)

    username: Username
    password: Password


class User(BaseModel):
    """사용자 응답. 비밀번호와 해시는 넣지 않는다."""

    id: int
    username: str
    created_at: datetime
