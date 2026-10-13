"""Task Flow API.

T05: 서버 동작 확인용 /api/health만 제공한다. 할 일 API는 T06부터 추가한다.
"""

from fastapi import FastAPI

app = FastAPI(title="Task Flow API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
