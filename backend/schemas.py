"""API 요청·응답 형식과 입력 규칙. 규칙은 API-SPEC.md를 따른다."""

import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

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


class TaskCreate(BaseModel):
    # 알 수 없는 필드(id, status, created_at 포함)는 거절하고, 타입 자동 변환(숫자→문자 등)은 하지 않는다.
    model_config = ConfigDict(extra="forbid", strict=True)

    title: Title
    description: Description = ""
    priority: Priority = "NORMAL"
    due_date: DueDate | None = None


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: datetime
