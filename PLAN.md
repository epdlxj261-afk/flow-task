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
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  기록(2026-10-13): 변경 파일 frontend/app.js, index.html(storage-error→api-error), styles.css, backend/main.py(CORS).
  - 저장을 localStorage에서 API 호출로 교체. 등록·수정·삭제 성공 시 GET으로 목록 재조회. 검색·필터는 받은 전체 목록에 화면에서 적용.
  - API 주소: 5500번 화면이면 같은 호스트의 8000번 /api, 그 외는 /api(5장 Nginx 대비).
  - CORS: http://127.0.0.1:5500, http://localhost:5500만 허용. 다른 출처 preflight 400 확인.
  - 가짜 DOM + 실제 API(8001) 통합 시험 24건 통과: 화면과 API 목록 일치, 등록·상태 변경·수정·삭제·삭제 취소, 필터 중 해당 id만 수정·삭제, curl 삭제 항목 변경 시 404 안내·재조회, API 중지 시 오류 배너·목록 유지·이전 상태 복귀, 복구 후 정상.
  - API 회귀: T06 24건, T07 58건 통과. 정적 서버 /, styles.css, app.js 200.
  - 사용자 브라우저 확인 1차: API 중지 후 등록 시 빨간 안내 없이 등록만 막힘. WSL 안 curl은 즉시 연결 거부(0.0001초)라 재현 안 됨.
    원인 확정: Windows 브라우저→WSL 포트 전달에서 API가 꺼져도 연결이 거부되지 않고 대기(사용자 확인: 약 10초 뒤 안내 표시).
  - 수정: 요청 제한 시간 10초(AbortController) 추가, 요청 중 오류가 나도 버튼 잠금이 풀리도록 finally 처리.
  - 통합 시험 28건 통과(응답 없는 API → 약 10초 뒤 빨간 안내·버튼 복구, 복구 후 등록 성공 포함).
  - 사용자 브라우저 재확인(2026-10-13): API 중지 시 약 10초 뒤 빨간 안내, 재시작 후 등록 정상, 화면과 curl 목록 일치. 남은 오류 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  기록(2026-10-13): 변경 파일 scripts/setup_local_db.sh, .env.example(신규). .env는 Git 제외(.gitignore).
  - MariaDB 11.8.6 설치·실행 중(127.0.0.1:3306) 확인. sudo가 필요해 사용자가 ./scripts/setup_local_db.sh 실행.
  - DB task_flow(utf8mb4, 기존 DB라 collation은 utf8mb4_uca1400_ai_ci 유지), 사용자 task_flow_app@localhost·@127.0.0.1.
  - 권한: task_flow.*에 SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER만 부여(DROP 제외).
  - .env 권한 600, 비밀번호는 무작위 생성·화면 미출력.
  - 접속 확인: .env 값으로 접속 성공(CURRENT_USER task_flow_app@localhost, SELECT 1), 잘못된 비밀번호 1045 거절, mysql DB 접근 1044 거절, 보이는 DB는 information_schema·task_flow뿐, 테이블 0개.
  - 진행 중 문제: (1) 이전에 만든 task_flow_app@localhost가 있어 CREATE USER 실패 → 사용자 동의 후 DROP USER 뒤 재실행.
    (2) 실패 시 MariaDB가 SQL 문장을 출력해 새 비밀번호가 노출됨(실제 계정에는 쓰이지 않음) → SQL에 평문 대신 비밀번호 해시 사용, 사용자 존재 여부를 먼저 확인하도록 스크립트 수정.
  - 참고: mariadb 클라이언트가 --ssl-verify-server-cert 비활성 경고를 출력함. 로컬 접속이라 영향 없음, T12 서버 분리 시 TLS 검토.
  - 남은 오류 없음.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  기록(2026-10-13): 변경 파일 backend/database.py·models.py·init_db.py(신규), requirements.txt.
  - 패키지 추가: SQLAlchemy 2.1.4(DB 조작), PyMySQL 1.2.3(MariaDB 드라이버), python-dotenv 1.2.4(.env 읽기).
  - 실행: .venv/bin/python -m backend.init_db → "tasks: 새로 만들었습니다.", 재실행 시 "이미 있습니다. 변경하지 않았습니다."(create_all checkfirst, 삭제·변경 없음).
  - SHOW CREATE TABLE: id int AUTO_INCREMENT PK, title varchar(100), description varchar(2000) DEFAULT '', status enum(TODO,DOING,DONE) DEFAULT TODO, priority enum(HIGH,NORMAL,LOW) DEFAULT NORMAL, due_date date NULL, created_at datetime(UTC), InnoDB utf8mb4.
  - 제약 확인(롤백 트랜잭션, 시험 후 0행): 한글 100자 제목·이모지 2000자 설명 저장, 101자 제목·2001자 설명 1406 거절, 없는 상태·우선순위 1265 거절(sql_mode STRICT_TRANS_TABLES).
  - 참고: 롤백한 INSERT로 AUTO_INCREMENT가 증가해 첫 id가 1이 아닐 수 있음(API-SPEC상 문제 없음).
  - 남은 오류 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  기록(2026-10-13): 변경 파일 backend/main.py, API-SPEC.md(503 응답 추가). 프런트엔드 변경 없음(API 계약 유지).
  - 요청마다 DB 세션 사용. 제목 검색은 lower(title)을 utf8mb4_bin으로 비교해 대소문자만 무시(기본 ai_ci의 악센트 무시 방지), %·_는 글자로 취급.
  - DB 접속 실패 시 503 {"detail":"Database unavailable"}. DB_PORT=3999로 실행해 GET·POST 503, /api/health 200 확인. 로그에 비밀번호 없음.
  - API(8001)+실제 DB 시험 34건 통과: 등록·기본값·한글·이모지·100자/2000자, 422 거절 11종, PATCH 미전달 필드 유지·due_date null, 없는 ID 404, 필터 AND·한글·%_ 검색, DELETE 204·재삭제 404.
  - SQL 조회: SELECT ... FROM tasks WHERE id IN (2,3,5,6)로 API로 등록·수정한 행(상태 DOING, 마감일 2026-12-31 등) 확인.
  - 재시작: API 종료(000) 후 재시작 → 4건과 수정 내용 유지. 시험 행은 시험 후 삭제(0건 확인).
  - 참고: 메모리 단계용 T06·T07 시험은 id 1부터 시작을 가정해 DB 단계에서는 그대로 쓸 수 없어, 같은 내용을 자기 행만 다루는 시험으로 다시 작성.
  - 남은 오류 없음.
## 5장: 서버 분리
- [x] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
  기록(2026-10-14): 사용자 보고로 완료 표시(사용자 요청). 저장소 변경 파일 없음.
  - 서버 구성·실행 명령·출력은 제출되지 않았고, Claude는 분리된 서버에 접속할 수 없어 직접 확인하지 못함.
  - 진행 중 문제(로컬 WSL): .env의 DB_PASSWORD만 바뀌고 DB 계정 비밀번호는 그대로여서 1045 Access denied → API 503.
    사용자가 sudo mariadb에서 ALTER USER로 계정 비밀번호를 .env 값에 맞춤 → 접속·SELECT 1 성공, API(8001) /api/health·/api/tasks·/ 200 확인.
  - 미확인: T09에서 남긴 서버 간 TLS 적용 여부.
- [x] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
  진행 기록(2026-10-14): 변경 파일 deploy/task-flow-api.service, scripts/setup_app_server.sh(신규). 코드 변경 없음.
  - 구성: 코드 /opt/task-flow, 가상환경 /opt/task-flow/.venv(root 소유), 실행 사용자 taskflow(로그인 불가 시스템 계정),
    환경변수 /etc/task-flow/api.env(root:taskflow 640, .env.example 형식, 이미 있으면 덮어쓰지 않음), 0.0.0.0:8000, Restart=on-failure, 부팅 시 자동 시작.
  - 순서: sudo git clone <저장소> /opt/task-flow → sudo /opt/task-flow/scripts/setup_app_server.sh(api.env 생성 후 멈춤)
    → sudo nano /etc/task-flow/api.env(DB_HOST=DB 서버 사설 IP 등) → 스크립트 재실행(설치·시작·/api/health 확인).
  - WSL 확인: bash -n 통과, systemd-analyze verify(경로만 로컬로 바꾼 사본) 경고 없음, sudo 없이 실행 시 거절.
    같은 설정을 사용자 서비스로 8001번 실행(.env 없는 코드 사본 + EnvironmentFile): /api/health 200, /api/tasks 200, / 200,
    kill -9 후 자동 재시작(새 PID, health 200), DB_PORT=3999 환경파일로 /api/tasks 503·health 200, 로그에 비밀번호 없음. 시험 서비스 삭제.
  - 시험 한계: 사용자 서비스라 User=taskflow는 빼고, /tmp의 사본을 쓰느라 PrivateTmp·ProtectHome도 뺐다(실제 경로 /opt에서는 해당 없음).
  - 설치 확인(2026-10-14, 사용자 완료 보고): App 서버 역할을 WSL(호스트 MZC)에서 수행. sudo git clone 후 setup_app_server.sh 실행.
    Claude 확인: 배포 커밋 ed8683e, task-flow-api active·enabled, 프로세스 사용자 taskflow, /etc/task-flow root:taskflow 750(일반 사용자 api.env 읽기 불가),
    /etc/systemd/system/task-flow-api.service = deploy 파일, 8000번 /api/health·/api/tasks·/ 200(127.0.0.1·WSL IP 모두), 브라우저 요청 로그 200.
  - 진행 중 문제: api.env의 DB_HOST를 다른 IP로 넣었을 때 /api/health 200이지만 /api/tasks 응답 없음(DB 연결 대기). DB_HOST=127.0.0.1로 바꾼 뒤 200.
    스크립트가 /api/tasks 실패에도 "완료"를 출력하고 curl 대기(5초)가 DB 접속 대기(10초)보다 짧았음 → 15초 대기, 200이 아니면 오류로 종료하도록 수정.
  - 한계: App과 DB가 같은 WSL(DB_HOST=127.0.0.1)이라 PRD의 서버 분리 상태는 아님. 분리된 DB 서버 연결은 api.env의 DB_HOST 변경·재시작으로 전환.
  - 참고: 8000번을 서비스가 사용하므로 직접 uvicorn을 8000번으로 띄우려면 sudo systemctl stop task-flow-api 후 실행.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
개발 편의(2026-10-13 사용자 요청 추가): 위 uvicorn 하나로 화면(http://127.0.0.1:8000/)과 API(/api)를 함께 제공한다.
  backend/main.py가 frontend/를 StaticFiles로 / 아래에 연결하며 /api·/docs가 우선한다. 5500번 정적 서버 방식도 계속 사용할 수 있다.
  확인: /, styles.css, app.js 200, /api/health·/api/tasks·/docs 200, 없는 경로 404, /../.env 등 경로 우회 6종 404(.env 노출 없음),
  화면이 상대 경로 /api/tasks로 등록·조회하고 API 목록과 일치(시험 행 삭제).
  5장 배포에서는 PRD대로 Web 서버의 Nginx가 화면을 제공한다(T14).
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.