"""Task Flow API.

메모리 저장 방식으로 할 일 목록 조회(필터 포함)·등록·부분 수정·삭제를 제공한다.
메모리 단계이므로 API를 재시작하면 데이터가 사라진다.
T08: 개발용 정적 서버(5500번)의 화면이 API(8000번)를 호출할 수 있도록 CORS를 허용한다.
"""

from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

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

# 메모리 저장소. 등록 순서(id 오름차순)로 보관한다.
tasks: list[Task] = []
next_id = 1
# 요청이 동시에 들어와도 id가 겹치거나 수정이 섞이지 않도록 하나씩 처리한다.
tasks_lock = Lock()


def find_index(task_id: int) -> int:
    for index, task in enumerate(tasks):
        if task.id == task_id:
            return index
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    # 쿼리 이름은 status지만, fastapi.status 모듈과 이름이 겹치지 않도록 변수명을 바꾼다.
    status_filter: Status | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
) -> list[Task]:
    # 모든 조건을 AND로 적용한다. 검색어는 앞뒤 공백을 지우고 대소문자를 구분하지 않는다.
    query = (q or "").strip().lower()
    with tasks_lock:
        return [
            task
            for task in tasks
            if (query == "" or query in task.title.lower())
            and (status_filter is None or task.status == status_filter)
            and (priority is None or task.priority == priority)
        ]


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    global next_id

    with tasks_lock:
        task = Task(
            id=next_id,
            title=payload.title,
            description=payload.description,
            status="TODO",
            priority=payload.priority,
            due_date=payload.due_date,
            created_at=datetime.now(timezone.utc).replace(microsecond=0),
        )
        tasks.append(task)
        next_id += 1
    return task


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    # 보내지 않은 필드는 기존 값을 유지한다.
    changes = payload.model_dump(exclude_unset=True)
    with tasks_lock:
        index = find_index(task_id)
        tasks[index] = tasks[index].model_copy(update=changes)
        return tasks[index]


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    with tasks_lock:
        del tasks[find_index(task_id)]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
