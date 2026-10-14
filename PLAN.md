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
- [x] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
  진행 기록(2026-10-14): 변경 파일 deploy/nginx/task-flow.conf, scripts/setup_web_server.sh(신규). 코드 변경 없음(app.js는 이미 5500 외에는 /api 사용).
  - 구성: 80번 default_server, 화면 /var/www/task-flow, /api/ → upstream(App 주소:포트, 기본 127.0.0.1:8000, 스크립트 인자로 변경),
    숨김 파일 404, server_tokens off, 요청 본문 64k, proxy_read_timeout 30s(App의 503 전달). 기본 사이트는 sites-enabled 링크만 해제, nginx -t 실패 시 원복.
  - WSL 확인(sudo 없이 같은 설정을 8081번 Nginx + 8001번 API로 실행): nginx -t 통과, bash -n 통과.
    /, styles.css, app.js 200(MIME 정상), /api/health·/api/tasks 200, /.env 404, /../.env 400, /docs·없는 경로 404.
    Web 주소로 POST 성공(id 발급) → SQL로 행 확인(제목 HTML 글자 그대로) → PATCH 200, 빈 제목 422 → App 중지 시 502 → App 재시작 후 같은 행·DOING 유지 → DELETE 204·재삭제 404·DB 0행.
  - 사용자 실행: setup_web_server.sh가 /api/tasks 404로 실패 보고. 원인은 reload 직후 이전 설정 프로세스가 응답(/가 기본 페이지 615바이트, 24초 뒤 200 확인).
    → 화면이 설치 파일과 같아질 때까지 최대 10초 기다린 뒤 확인하도록 수정. 80번으로 POST 201·DB 행(id 13) 확인.
  - 사용자 요청 변경 1: 화면은 127.0.0.1(80)로만, 127.0.0.1:8000 접속 불가 → App을 Unix 소켓으로 바꿔 사용자가 적용(8000 닫힘, 80 정상 확인).
  - 사용자 요청 변경 2: 8000번은 FastAPI(API)만 사용 → 소켓 방식 취소. App은 127.0.0.1:8000에서 /api만 제공, 화면은 Nginx(80)만 제공.
    backend/main.py에서 frontend StaticFiles 연결(2026-10-13 개발 편의) 제거. 서비스 --host 127.0.0.1 --port 8000, Nginx upstream 기본 127.0.0.1:8000.
    WSL 확인(8001 API + 8081 Nginx): API 직접 /·index.html·app.js·styles.css 404, /api/health·/api/tasks·/docs 200, 5500 출처 CORS preflight 200,
    Nginx /·app.js·/api/health·/api/tasks 200, Nginx로 POST·DELETE 정상(시험 행 삭제).
  - 사용자 적용(13:07): main.py를 /opt/task-flow에 복사, 서비스 파일 교체·재시작, setup_web_server.sh 실행 → 5/5에서 /api/tasks 502 보고.
    원인: App 재시작 직후(약 1초) 아직 뜨는 중에 확인. 로그상 13:07:10 시작, 13:07:23부터 Nginx 경유 /api/tasks 200.
    → 1/5에서 App /api/health를 최대 10초 기다리도록 수정(떠 있으면 즉시, 없으면 10.2초 후 경고 확인).
  - 최종 확인(Claude, 2026-10-14): /opt main.py·/etc 서비스 파일 = 저장소 파일, App 127.0.0.1:8000만 listen.
    127.0.0.1/·/app.js·/api/health·/api/tasks 200, 127.0.0.1:8000/·/app.js 404({"detail":"Not Found"}), :8000/api/health 200.
    Web 주소(80)로 등록한 id 13이 SQL로 확인되고 App 재시작(13:07) 후 80번 목록·DB에 유지. 확인 후 id 13 삭제.
  - 사용자 브라우저 확인(2026-10-14): http://127.0.0.1/ 정상 작동.
  - 남은 오류 없음. 한계: Web·App·DB가 같은 WSL(서버 분리 아님).
## 6장: 다중 사용자
- [x] T15: PRD에 다중 사용자·회원가입·로그인·로그아웃(F10~F14) 추가, PLAN에 T16~T20 추가.
  기록(2026-10-14): 변경 파일 PRD.md, PLAN.md(사용자 요청). 코드 변경 없음.
  - PRD 변경: 목적·범위를 다중 사용자로, 제외 기능에서 회원가입 삭제, 데이터에 user_id·사용자 추가, 로그인 방식(서버 세션+HttpOnly 쿠키, 7일) 추가,
    기존 할 일은 삭제하지 않고 어느 사용자에도 연결하지 않음(자동 이전 금지 원칙 유지), HTTPS는 범위 밖, 완료 기준 추가.
  - 남은 확인: API-SPEC.md는 아직 "인증 없음". T16에서 인증 계약을 먼저 작성한다.
- [x] T16: API-SPEC.md에 계정·인증 계약 작성, users 테이블과 회원가입 API(POST /api/auth/signup).
  비밀번호 해시 패키지 argon2-cffi를 requirements.txt에 추가한다.
  확인: 가입 201, 아이디 형식·비밀번호 길이 422, 중복 아이디 409, DB에 해시만 저장(원문 없음), 응답·로그에 비밀번호 없음.
  기록(2026-10-14): 변경 파일 API-SPEC.md, requirements.txt, backend/models.py·schemas.py·main.py·init_db.py.
  - 패키지 추가: argon2-cffi 25.1.0(비밀번호 argon2id 해시, 의존 argon2-cffi-bindings 26.1.0).
  - API-SPEC: User 데이터, 세션 쿠키 규칙(T17), signup·login·logout·me, 할 일 API 사용자 범위(T18), 401·409 오류 추가. 각 항목에 구현 작업 번호 표시.
  - users 테이블: id, username varchar(20) UNIQUE, password_hash varchar(255), created_at. python -m backend.init_db → "users: 새로 만들었습니다.", 재실행 시 변경 없음, tasks 4행 유지.
  - 계정 API(/api/auth/)의 422 응답에서 input 제거(필수 필드 누락 시 요청 전체가 input에 담겨 비밀번호가 응답에 실릴 수 있음). 할 일 API 422 형식은 그대로.
  - API(8001)+실제 DB 시험 35건 통과: 가입 201·응답에 id·username·created_at만, DB에 $argon2id$ 해시·해시로 원문 검증, 중복 409,
    경계(아이디 4·20자, 비밀번호 8·128자, 앞뒤 공백 유지, 이모지 8자) 허용, 422 15종(형식·길이·누락·알 수 없는 필드·타입·null·깨진 JSON·빈 본문)에 비밀번호 미노출·미저장,
    동시 가입 5건 → 201 1건·409 4건(500 없음), 할 일 GET·POST·PATCH·DELETE 회귀 정상, API 로그에 비밀번호 없음. 시험 계정 삭제(users 0행).
  - 참고: 가입 후 바로 로그인(F10)은 세션이 필요해 T17에서 추가. 운영 서비스(/opt, 80번)는 T20까지 이전 코드로 동작(users 테이블은 같은 DB에 생성됨).
  - 남은 오류 없음.
- [x] T17: sessions 테이블과 로그인·로그아웃·현재 사용자 API(POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me).
  확인: 로그인 시 HttpOnly 쿠키 발급, 틀린 아이디·비밀번호 모두 같은 401, me 200/401, 로그아웃 후 같은 쿠키로 401, 만료 세션 401.
  기록(2026-10-14): 변경 파일 backend/models.py·schemas.py·main.py·init_db.py. 새 패키지 없음(hashlib·secrets 표준 라이브러리).
  - sessions 테이블: token_hash varchar(64) PK(쿠키 토큰의 SHA-256, 원문 미저장), user_id FK→users ON DELETE CASCADE, created_at, expires_at(+7일).
    python -m backend.init_db → "sessions: 새로 만들었습니다.", tasks·users 변경 없음.
  - 토큰 secrets.token_urlsafe(32). 쿠키 task_flow_session: HttpOnly, SameSite=Lax, Path=/, Max-Age 604800, Secure 없음(HTTP 학습용).
  - 가입 시 바로 세션 발급(F10). 로그인 실패는 아이디 없음·비밀번호 틀림 모두 같은 401, 없는 아이디도 더미 해시로 검증해 응답 시간 차이 제거.
    만료 세션은 조회 시 401과 함께 삭제. 로그아웃은 세션 삭제+쿠키 삭제, 쿠키 없어도 204.
  - CORS allow_credentials=True(5500 개발 화면이 쿠키 전송, T19 대비). 출처 목록은 그대로.
  - 가입·로그인 요청 스키마 이름을 SignupRequest → Credentials로 변경(같은 규칙 공유).
  - API(8001)+실제 DB 시험 34건 통과: 가입·로그인 쿠키 속성, 본문에 토큰·비밀번호 없음, DB에 토큰 해시만, 만료=생성+7일, 로그인마다 새 토큰,
    틀린 비밀번호·없는 아이디 같은 401·쿠키 없음, 응답 시간 67ms/63ms, 로그인 422 입력값 미노출, me 401 3종, 로그아웃 204·Max-Age=0·이후 401·DB 삭제,
    다른 세션 유지, 반복 로그아웃 204, 만료 세션 401·삭제, 사용자 삭제 시 세션 CASCADE, 5500 preflight Allow-Credentials true·다른 출처 400,
    중복 가입 409·쿠키 없음, 할 일 API 회귀, 로그에 비밀번호·토큰 없음. T16 시험 35건 재통과. 시험 계정·세션 삭제(users 0, sessions 0, tasks 7~10 유지).
  - 진행 중 문제: 시험 스크립트가 preflight 응답(OK, JSON 아님)을 JSON으로 읽다 중단 → 시험 스크립트만 수정해 재실행.
  - 남은 오류 없음. 할 일 API 인증 적용은 T18.
- [ ] T18: tasks에 user_id 추가(기존 행은 NULL로 유지), 할 일 API를 로그인 사용자 범위로 제한.
  확인: 비로그인 401, 두 계정이 서로의 할 일을 목록에서 못 보고 id로 수정·삭제 시 404, 기존 행 삭제 없음·화면 미표시, 기존 필터·검증 회귀 통과.
- [ ] T19: 프런트엔드 회원가입·로그인 화면, 로그아웃 버튼, 401 시 로그인 화면 전환.
  확인: 가입→바로 로그인, 새로고침 후 유지, 로그아웃 후 로그인 화면, 틀린 비밀번호 안내, 아이디 HTML 입력 글자 표시, 기존 할 일 기능 정상.
- [ ] T20: App·Web 배포 반영(코드 갱신, 테이블 생성, 서비스 재시작, 화면 재설치).
  확인: Web 주소에서 두 계정 데이터 분리, App 재시작 후 로그인·데이터 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
개발 편의(2026-10-13 사용자 요청 추가, 2026-10-14 사용자 요청으로 제거): uvicorn이 화면도 함께 제공하던 StaticFiles 연결을 없앴다.
  이제 8000번은 API(/api, /docs)만 제공한다. 개발 중 화면은 5500번 정적 서버(T01~T04 명령)로 열면 8000번 API를 호출한다.
  배포에서는 PRD대로 Web 서버의 Nginx(80번)가 화면을 제공하고 /api/를 8000번으로 전달한다(T14).
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.