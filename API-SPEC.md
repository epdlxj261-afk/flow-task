# Task Flow API 명세

PRD.md의 요구사항(F01~F14)을 API로 제공하기 위한 계약이다.
구현 순서는 PLAN.md를 따른다. T05는 `/api/health`, T06은 목록 조회·등록, T07은 수정·삭제·필터를 구현한다.

## 공통
- 기본 경로: `/api`
- 요청·응답 형식: JSON (`Content-Type: application/json`), 문자 인코딩 UTF-8
- 인증: T17까지 할 일 API는 인증 없음. T18부터 할 일 API는 로그인 세션 쿠키가 필요하다. (아래 "계정과 인증")
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

## 계정과 인증 (6장)

### 데이터: User
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | integer | 서버가 발급하는 고유 번호 |
| `username` | string | 영문 소문자·숫자·밑줄 4~20자(`^[a-z0-9_]{4,20}$`), 중복 불가. 대문자·공백은 거절(자동 변환 없음) |
| `created_at` | string | 가입 시각. ISO 8601 UTC |

- 비밀번호는 8~128자(유니코드 문자 기준)이며 앞뒤 공백도 비밀번호의 일부로 그대로 쓴다.
- 서버는 비밀번호를 argon2id 해시로만 저장한다. 비밀번호와 해시는 어떤 응답·로그에도 넣지 않는다.
- 계정 API(`/api/auth/...`)의 `422` 응답에는 입력값(`input`)을 넣지 않는다.

응답 예:
```json
{ "id": 1, "username": "alice_01", "created_at": "2026-10-14T05:30:00Z" }
```

### 로그인 세션 (T17)
- 로그인·가입에 성공하면 서버가 세션을 저장하고 쿠키 `task_flow_session`을 발급한다.
- 쿠키 속성: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 7일. 학습용 HTTP 배포라 `Secure`는 붙이지 않는다.
- 세션은 마지막 로그인부터 7일 동안 유효하다. 만료되거나 로그아웃한 세션의 쿠키는 `401`이다.

### POST /api/auth/signup  (T16, 세션 발급은 T17)
회원가입한다.
```json
{ "username": "alice_01", "password": "correct horse 9" }
```
- 응답 `201 Created`: User
- T17부터 가입과 동시에 로그인 세션 쿠키를 발급한다. (F10)
- 아이디 형식·비밀번호 길이 위반, 알 수 없는 필드, 문자열이 아닌 값: `422`
- 이미 있는 아이디: `409` `{ "detail": "Username already exists" }`

### POST /api/auth/login  (T17)
로그인한다. 요청 본문은 signup과 같다.
- 응답 `200 OK`: User, 세션 쿠키 발급
- 아이디가 없거나 비밀번호가 틀림: 둘을 구분하지 않고 `401` `{ "detail": "Invalid username or password" }` (F11)

### POST /api/auth/logout  (T17)
로그아웃한다. 서버의 세션을 삭제하고 쿠키를 지운다.
- 응답 `204 No Content`. 이미 로그아웃한 상태여도 `204`

### GET /api/auth/me  (T17)
현재 로그인한 사용자를 확인한다. 화면이 처음 열릴 때 로그인 상태 판단에 쓴다. (F14)
- 응답 `200 OK`: User
- 로그인하지 않음·세션 만료: `401` `{ "detail": "Not authenticated" }`

### 할 일 API의 사용자 범위 (T18)
- 모든 `/api/tasks` 요청은 로그인 세션이 필요하다. 없으면 `401` `{ "detail": "Not authenticated" }`
- 목록·등록·수정·삭제는 로그인한 사용자의 할 일만 대상으로 한다. (F13)
- 다른 사용자의 할 일 `id`로 수정·삭제하면 존재 여부를 알리지 않도록 `404` `{ "detail": "Task not found" }`
- Task 응답 형식은 바꾸지 않는다(`user_id`는 응답에 넣지 않는다).
- 다중 사용자 전환 전의 할 일은 어느 사용자에게도 속하지 않으므로 어떤 계정에서도 보이지 않는다.

## 오류 응답
| 상태 코드 | 의미 | 본문 |
|---|---|---|
| `401 Unauthorized` | 로그인 필요, 세션 만료, 로그인 실패 (T17 이후) | `{ "detail": "Not authenticated" }` 또는 `{ "detail": "Invalid username or password" }` |
| `409 Conflict` | 이미 있는 아이디로 가입 (T16 이후) | `{ "detail": "Username already exists" }` |
| `404 Not Found` | 해당 `id`의 할 일이 없음 | `{ "detail": "Task not found" }` |
| `422 Unprocessable Content` | 입력 규칙 위반 | FastAPI 기본 검증 오류 형식 (`detail` 배열) |
| `503 Service Unavailable` | DB에 접속할 수 없음 (T11 이후) | `{ "detail": "Database unavailable" }` |

## 단계별 저장 방식
| 단계 | 저장 위치 | API 재시작 시 |
|---|---|---|
| T06~T08 | API 프로세스 메모리 | 데이터가 사라진다 (정상) |
| T11 이후 | MariaDB | 데이터가 유지되어야 한다 |

저장 방식이 바뀌어도 이 문서의 요청·응답 계약은 바꾸지 않는다.
