"""Task Flow API.

T06: 메모리 저장 방식으로 할 일 목록 조회(GET)와 등록(POST)을 제공한다.
메모리 단계이므로 API를 재시작하면 데이터가 사라진다. 수정·삭제·필터는 T07에서 추가한다.
"""

from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, status

from backend.schemas import Task, TaskCreate

app = FastAPI(title="Task Flow API")

# 메모리 저장소. 등록 순서(id 오름차순)로 보관한다.
tasks: list[Task] = []
next_id = 1
# 요청이 동시에 들어와도 id가 겹치지 않도록 등록을 하나씩 처리한다.
tasks_lock = Lock()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks() -> list[Task]:
    with tasks_lock:
        return list(tasks)


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
