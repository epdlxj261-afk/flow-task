# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  기록(2026-10-13): 변경 파일 frontend/index.html, styles.css, app.js.
  - http.server 5500 실행 후 /, styles.css, app.js 모두 200 응답.
  - 가짜 DOM 스크립트로 app.js 시험 10건 통과(두 항목 등록, 빈 제목·공백 제목·101자 거절, 100자 허용, HTML 입력 글자 표시).
  - 사용자 브라우저 확인(2026-10-13): 두 항목 등록, 빈 제목 거절, 새로고침 시 초기화 정상. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  기록(2026-10-13): 변경 파일 frontend/index.html, styles.css, app.js.
  - http.server 5500 실행 후 /, styles.css, app.js 모두 200 응답.
  - 가짜 DOM·localStorage 스크립트로 시험 16건 통과(새로고침 후 목록·id 유지, 빈 제목 거절, 손상값 7종에서 경고·등록 차단·원본 유지, 저장 실패 시 화면·저장값 변화 없음).
  - 사용자 브라우저 확인(2026-10-13): 새로고침 후 목록 유지, 손상값 경고·등록 차단·원본 유지 정상. 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  기록(2026-10-13): 변경 파일 frontend/app.js, styles.css. 수정 대상은 제목만(설명은 T04).
  - http.server 5500 실행 후 /, styles.css, app.js 모두 200 응답.
  - 가짜 DOM 스크립트로 시험 23건 통과(상태 변경·유지, 해당 항목만 수정, 빈 제목·101자 수정 거절, 수정 취소, 삭제 취소 시 유지, 같은 제목 항목도 id로 정확히 수정·삭제, status 없는 T02 데이터는 TODO로 표시, 저장 실패 시 화면 복귀).
  - 사용자 브라우저 확인(2026-10-13): 상태 변경·유지, 해당 항목만 수정, 삭제 취소 시 유지 정상. 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  기록(2026-10-13): 변경 파일 frontend/index.html, styles.css, app.js.
  - http.server 5500 실행 후 /, styles.css, app.js 모두 200 응답.
  - 가짜 DOM 스크립트로 시험 38건 통과(기본값, 2001자 설명·잘못된 날짜 거절, 어제 마감 TODO·DOING 지연/DONE·오늘·내일 비지연, 검색·상태·우선순위 AND 필터, 필터 중 해당 항목만 수정·삭제, 삭제 취소 유지, 수정 중 입력값 보존, T03 데이터 기본값 표시, 손상값 차단). Asia/Seoul·UTC·America/Los_Angeles·Pacific/Kiritimati 시간대에서 동일 통과.
  - 함께 수정: 수정 중 다른 항목 변경·검색 시 입력 중인 값이 사라지던 문제.
  - 사용자 브라우저 확인(2026-10-13): 어제 마감 지연 표시·완료 시 해제, 필터 중 해당 항목만 수정·삭제, 검색·필터 AND, 이전 데이터 기본값 표시 정상. 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  기록(2026-10-13): 변경 파일 API-SPEC.md, backend/__init__.py, backend/main.py, requirements.txt, .gitignore.
  - 준비: python3 -m venv .venv, .venv/bin/python -m pip install fastapi uvicorn (fastapi 0.143.0, uvicorn 0.54.0, Python 3.14.4).
  - 실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  - curl http://127.0.0.1:8000/api/health → 200, {"status":"ok"}. /docs 200. /api/tasks는 아직 404(T06 범위).
  - API-SPEC 결정: id는 서버 발급 정수, created_at은 ISO 8601 UTC, 지연 여부는 프런트엔드가 로컬 날짜로 계산.
  - 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  기록(2026-10-13): 변경 파일 backend/schemas.py(신규), backend/main.py.
  - curl 시험 25건 통과: 등록 201(앞뒤 공백 제거, 기본값 description ""·priority NORMAL·due_date null·status TODO, 100자 제목·2000자 설명 허용), 목록 200(id 오름차순, 거절 항목 미등록).
  - 422 확인: 빈·공백·누락·101자·숫자 제목, 2001자 설명, 잘못된·소문자 우선순위, 2026-02-30·2026/10/20·20261020 날짜, status·id·알 수 없는 필드 전달, 잘못된 JSON.
  - 포트 8001에 별도 실행해 재시작 후 목록이 []로 비는 것 확인(메모리 단계 정상 동작).
  - 참고: 시험 중 사용자가 띄운 8000번 서버(--reload)에 시험 데이터 6건이 등록됨. 해당 서버를 재시작하면 사라진다.
  - 사용자 /docs 확인(2026-10-13): POST 201 등록 후 GET 목록에서 조회, 빈 제목 422 정상. 남은 오류 없음.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  기록(2026-10-13): 변경 파일 backend/schemas.py(TaskUpdate 추가), backend/main.py.
  - 실행: 사용자 8000번 서버와 겹치지 않게 --port 8001로 별도 실행 후 curl 시험.
  - curl 시험 58건 통과: PATCH 미전달 필드 유지(상태만·제목/설명만·due_date null로 삭제·빈 본문), 다른 항목 영향 없음, id·created_at 유지.
  - PATCH 거절: 없는 ID 404({"detail":"Task not found"}), 숫자 아닌 ID·title/description/status/priority null·빈 제목·소문자/없는 상태·없는 날짜·id/created_at/알 수 없는 필드·101자 제목·2001자 설명 422, 거절 후 값 변화 없음.
  - 필터: q(대소문자·앞뒤 공백 무시, 한글), status, priority AND 적용, 결과 없음 [], 잘못된 필터 값 422.
  - DELETE: 204(본문 없음), 해당 항목만 삭제, 재삭제·삭제된 ID 수정·없는 ID 404, 삭제된 id 재사용 안 함.
  - T06 회귀 시험 24건 통과. 남은 오류 없음.
- [ ] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
## 4장: DB
- [ ] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.