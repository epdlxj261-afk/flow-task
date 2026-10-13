"""Task Flow API.

할 일 목록 조회(필터 포함)·등록·부분 수정·삭제를 제공한다.
T11: 저장소를 메모리에서 MariaDB로 바꿔, API를 재시작해도 데이터가 유지된다.
T08: 개발용 정적 서버(5500번)의 화면이 API(8000번)를 호출할 수 있도록 CORS를 허용한다.
"""

from collections.abc import Iterator
from datetime import date, datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import TaskRecord
from backend.schemas import Priority, Status, Task, TaskCreate, TaskUpdate

app = FastAPI(title="Task Flow API")

# 개발 단계에서만 필요한 설정이다. 5장에서 Nginx가 화면과 /api를 같은 주소로 제공하면 쓰이지 않는다.
DEV_FRONTEND_ORIGINS = ["http://127.0.0.1:5500", "http://localhost:5500"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    # DB 접속 실패 등은 서버 내부 오류(500) 대신 503으로 알린다. 접속 정보는 응답에 넣지 않는다.
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable"},
    )


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def to_task(record: TaskRecord) -> Task:
    return Task(
        id=record.id,
        title=record.title,
        description=record.description,
        status=record.status,
        priority=record.priority,
        due_date=record.due_date.isoformat() if record.due_date else None,
        # DB에는 시간대 없이 UTC로 저장하므로, 응답할 때 UTC 시간대를 붙인다.
        created_at=record.created_at.replace(tzinfo=timezone.utc),
    )


def get_record(db: Session, task_id: int) -> TaskRecord:
    record = db.get(TaskRecord, task_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return record


def to_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value is not None else None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    # 쿼리 이름은 status지만, fastapi.status 모듈과 이름이 겹치지 않도록 변수명을 바꾼다.
    status_filter: Status | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
    db: Session = Depends(get_db),
) -> list[Task]:
    # 모든 조건을 AND로 적용한다.
    statement = select(TaskRecord).order_by(TaskRecord.id)
    query = (q or "").strip().lower()
    if query:
        # 기본 정렬 규칙(ai_ci)은 악센트까지 무시하므로, 소문자로 바꾼 뒤 이진 비교해 대소문자만 무시한다.
        # autoescape로 검색어의 %와 _를 와일드카드가 아닌 글자로 취급한다.
        statement = statement.where(
            func.lower(TaskRecord.title).collate("utf8mb4_bin").contains(query, autoescape=True)
        )
    if status_filter is not None:
        statement = statement.where(TaskRecord.status == status_filter)
    if priority is not None:
        statement = statement.where(TaskRecord.priority == priority)
    return [to_task(record) for record in db.scalars(statement)]


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
    record = TaskRecord(
        title=payload.title,
        description=payload.description,
        status="TODO",
        priority=payload.priority,
        due_date=to_date(payload.due_date),
        created_at=datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return to_task(record)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    record = get_record(db, task_id)
    # 보내지 않은 필드는 기존 값을 유지한다.
    changes = payload.model_dump(exclude_unset=True)
    if "due_date" in changes:
        changes["due_date"] = to_date(changes["due_date"])
    for field, value in changes.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return to_task(record)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> Response:
    record = get_record(db, task_id)
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
