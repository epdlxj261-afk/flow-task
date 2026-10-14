"""Task Flow API.

할 일 목록 조회(필터 포함)·등록·부분 수정·삭제를 제공한다.
T11: 저장소를 메모리에서 MariaDB로 바꿔, API를 재시작해도 데이터가 유지된다.
T08: 개발용 정적 서버(5500번)의 화면이 API(8000번)를 호출할 수 있도록 CORS를 허용한다.
T14: 화면은 Web 서버의 Nginx(또는 개발용 5500번 정적 서버)가 제공하고, 이 API 서버는 /api만 제공한다.
T16: 회원가입 API를 제공한다. 비밀번호는 argon2id 해시로만 저장한다.
T17: 로그인·로그아웃·현재 사용자 API. 서버 세션과 HttpOnly 쿠키로 로그인 상태를 유지한다.
"""

import hashlib
import secrets
from collections.abc import Iterator
from datetime import date, datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import SessionRecord, TaskRecord, UserRecord
from backend.schemas import Credentials, Priority, Status, Task, TaskCreate, TaskUpdate, User

app = FastAPI(title="Task Flow API")

# 개발 단계에서만 필요한 설정이다. 5장에서 Nginx가 화면과 /api를 같은 주소로 제공하면 쓰이지 않는다.
DEV_FRONTEND_ORIGINS = ["http://127.0.0.1:5500", "http://localhost:5500"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
    # 5500번 화면이 8000번 API에 로그인 쿠키를 보내고 받을 수 있게 한다. 출처를 목록으로 제한했으므로 안전하다.
    allow_credentials=True,
)


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    # DB 접속 실패 등은 서버 내부 오류(500) 대신 503으로 알린다. 접속 정보는 응답에 넣지 않는다.
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable"},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # 계정 API의 422 응답에는 입력값(input)을 넣지 않는다. 필수 필드 누락 오류는 요청 전체를 input에 담아 비밀번호가 응답에 실릴 수 있다.
    if request.url.path.startswith("/api/auth/"):
        errors = [{key: value for key, value in error.items() if key != "input"} for error in exc.errors()]
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": errors})
    return await request_validation_exception_handler(request, exc)


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


def utc_now() -> datetime:
    # DB에는 시간대 없이 UTC 시각(초 단위)을 저장한다.
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def to_user(record: UserRecord) -> User:
    return User(id=record.id, username=record.username, created_at=record.created_at.replace(tzinfo=timezone.utc))


# argon2id 기본 설정(메모리 64MiB, 반복 3회)으로 해시한다. 해시 문자열에 설정과 salt가 함께 들어간다.
password_hasher = PasswordHasher()
# 없는 아이디로 로그인할 때도 같은 시간만큼 검증해, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
DUMMY_PASSWORD_HASH = password_hasher.hash(secrets.token_urlsafe(16))

SESSION_COOKIE = "task_flow_session"
SESSION_LIFETIME = timedelta(days=7)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, response: Response, user_id: int) -> None:
    """세션을 저장하고 쿠키를 발급한다. 호출한 쪽에서 commit한다."""
    token = secrets.token_urlsafe(32)
    now = utc_now()
    db.add(SessionRecord(token_hash=hash_token(token), user_id=user_id, created_at=now, expires_at=now + SESSION_LIFETIME))
    # 학습용 HTTP 배포라 Secure는 붙이지 않는다. HTTPS를 쓰면 secure=True로 바꾼다.
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        httponly=True,
        samesite="lax",
    )


def get_current_user(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> UserRecord:
    not_authenticated = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not token:
        raise not_authenticated
    session = db.get(SessionRecord, hash_token(token))
    if session is None:
        raise not_authenticated
    if session.expires_at <= utc_now():
        # 만료된 세션은 찾은 김에 지운다.
        db.delete(session)
        db.commit()
        raise not_authenticated
    user = db.get(UserRecord, session.user_id)
    if user is None:
        raise not_authenticated
    return user


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: Credentials, response: Response, db: Session = Depends(get_db)) -> User:
    username_taken = HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if db.scalar(select(UserRecord.id).where(UserRecord.username == payload.username)) is not None:
        raise username_taken
    record = UserRecord(
        username=payload.username,
        password_hash=password_hasher.hash(payload.password),
        created_at=utc_now(),
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        # 동시에 같은 아이디로 가입하면 위 확인을 둘 다 통과할 수 있어, DB의 UNIQUE 제약으로 한 번 더 막는다.
        db.rollback()
        raise username_taken from None
    # 가입하면 바로 로그인 상태가 된다. (F10)
    start_session(db, response, record.id)
    db.commit()
    db.refresh(record)
    return to_user(record)


@app.post("/api/auth/login")
def login(payload: Credentials, response: Response, db: Session = Depends(get_db)) -> User:
    record = db.scalar(select(UserRecord).where(UserRecord.username == payload.username))
    try:
        password_hasher.verify(record.password_hash if record else DUMMY_PASSWORD_HASH, payload.password)
    except VerificationError:
        record = None
    if record is None:
        # 아이디가 없는 경우와 비밀번호가 틀린 경우를 구분하지 않는다. (F11)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if password_hasher.check_needs_rehash(record.password_hash):
        # 해시 설정이 바뀌었으면 맞는 비밀번호를 받은 김에 새 설정으로 다시 저장한다.
        record.password_hash = password_hasher.hash(payload.password)
    start_session(db, response, record.id)
    db.commit()
    return to_user(record)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> Response:
    if token:
        db.execute(delete(SessionRecord).where(SessionRecord.token_hash == hash_token(token)))
        db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return response


@app.get("/api/auth/me")
def me(user: UserRecord = Depends(get_current_user)) -> User:
    return to_user(user)


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
