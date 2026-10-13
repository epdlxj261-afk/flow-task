# Task Flow API 명세

PRD.md의 요구사항(F01~F09)을 API로 제공하기 위한 계약이다.
구현 순서는 PLAN.md를 따른다. T05는 `/api/health`, T06은 목록 조회·등록, T07은 수정·삭제·필터를 구현한다.

## 공통
- 기본 경로: `/api`
- 요청·응답 형식: JSON (`Content-Type: application/json`), 문자 인코딩 UTF-8
- 인증: 없음 (로그인 없는 단일 사용자 앱)
- 개발 실행 주소: `http://127.0.0.1:8000`
- 자동 문서: `/docs` (FastAPI Swagger UI)

## 데이터: Task

| 필드 | 타입 | 규칙 | 기본값 |
|---|---|---|---|
| `id` | integer | 서버가 발급하는 고유 번호. 수정·삭제는 이 값으로 처리한다. | 서버 발급 |
| `title` | string | 앞뒤 공백 제거 후 1~100자 | 필수 |
| `description` | string | 앞뒤 공백 제거 후 0~2000자 | `""` |
| `status` | string | `TODO`, `DOING`, `DONE` 중 하나 | `TODO` |
| `priority` | string | `HIGH`, `NORMAL`, `LOW` 중 하나 | `NORMAL` |
| `due_date` | string \| null | `YYYY-MM-DD` 형식의 실제 존재하는 날짜, 미지정은 `null` | `null` |
| `created_at` | string | 서버가 기록하는 등록 시각. ISO 8601 UTC (예: `2026-10-13T05:30:00Z`) | 서버 기록 |

- 글자 수는 유니코드 문자(코드 포인트) 기준으로 센다. 프런트엔드(`Array.from(text).length`)와 같다.
- `id`와 `created_at`은 클라이언트가 보내도 무시하지 않고 거절한다(422). 서버만 정한다.
- 지연 여부는 사용자의 로컬 날짜가 기준이므로 API가 계산하지 않고 프런트엔드가 표시한다. (F09)
- 단계 간 데이터는 자동 이전하지 않는다. 브라우저 단계의 문자열 id와 API의 정수 id는 호환하지 않는다.

응답 예:
```json
{
  "id": 1,
  "title": "보고서 쓰기",
  "description": "",
  "status": "TODO",
  "priority": "NORMAL",
  "due_date": null,
  "created_at": "2026-10-13T05:30:00Z"
}
```

## 엔드포인트

### GET /api/health  (T05)
API 서버 동작 확인.
- 응답 `200 OK`
```json
{ "status": "ok" }
```

### GET /api/tasks  (T06, 필터는 T07)
할 일 목록을 등록 순서(`id` 오름차순)로 반환한다.

쿼리 파라미터(모두 선택, 함께 쓰면 AND 조건):

| 이름 | 설명 |
|---|---|
| `q` | 제목 검색어. 앞뒤 공백 제거 후 대소문자 구분 없이 제목에 포함되는지 검사. 빈 값이면 조건 없음 |
| `status` | `TODO`, `DOING`, `DONE` 중 하나 |
| `priority` | `HIGH`, `NORMAL`, `LOW` 중 하나 |

- 응답 `200 OK`: Task 배열. 결과가 없으면 `[]`
- 허용되지 않은 `status`·`priority` 값: `422`

### POST /api/tasks  (T06)
할 일을 등록한다.

요청 본문: `title`은 필수, `description`·`priority`·`due_date`는 선택.
```json
{ "title": "보고서 쓰기", "description": "", "priority": "HIGH", "due_date": "2026-10-20" }
```
- `status`는 받지 않는다. 새 할 일은 항상 `TODO`로 등록한다.
- 응답 `201 Created`: 등록된 Task
- 규칙 위반(빈 제목, 101자 제목, 2001자 설명, 잘못된 값·날짜, 알 수 없는 필드): `422`

### PATCH /api/tasks/{id}  (T07)
할 일의 일부 필드를 수정한다.

요청 본문: `title`, `description`, `status`, `priority`, `due_date` 중 바꿀 필드만 보낸다.
```json
{ "status": "DONE" }
```
- 보내지 않은 필드는 기존 값을 유지한다.
- `due_date`에 `null`을 보내면 마감일을 지운다.
- `title`, `description`, `status`, `priority`에 `null`을 보내면 `422`
- 응답 `200 OK`: 수정된 Task
- 없는 `id`: `404`
- 규칙 위반: `422`

### DELETE /api/tasks/{id}  (T07)
할 일을 삭제한다. 삭제 확인은 프런트엔드가 담당한다.
- 응답 `204 No Content` (본문 없음)
- 없는 `id`: `404`

## 오류 응답
| 상태 코드 | 의미 | 본문 |
|---|---|---|
| `404 Not Found` | 해당 `id`의 할 일이 없음 | `{ "detail": "Task not found" }` |
| `422 Unprocessable Content` | 입력 규칙 위반 | FastAPI 기본 검증 오류 형식 (`detail` 배열) |

## 단계별 저장 방식
| 단계 | 저장 위치 | API 재시작 시 |
|---|---|---|
| T06~T08 | API 프로세스 메모리 | 데이터가 사라진다 (정상) |
| T11 이후 | MariaDB | 데이터가 유지되어야 한다 |

저장 방식이 바뀌어도 이 문서의 요청·응답 계약은 바꾸지 않는다.
