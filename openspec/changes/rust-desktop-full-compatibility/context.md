# Rust 데스크톱 전체 호환 이식

기준: Soju06/codex-lb `f8ffbac2099a113fba54dfd8d77774f5bca80ffa`.
요구사항은 [spec.md](specs/desktop-full-compatibility/spec.md), 작업 상태는
[tasks.md](tasks.md)를 따른다.

## 확정한 방향

- 원본 전체 기능 호환. 작은 기능 집합으로 범위를 축소하지 않는다.
- 최종 앱의 백엔드는 전부 Rust. Python 서버를 내장하거나 실행하지 않는다.
- Tauri 창·트레이와 Rust 서버를 한 프로세스에서 소유한다.
- 기존 React 화면과 MIT 라이선스를 보존한다. 개발 미리보기 화면은 최종
  대시보드가 아니며, 원본 화면의 대체 구현으로 취급하지 않는다.
- 첫 검증 환경은 macOS arm64. 다른 운영체제 검증은 미완료다.
- 기준 Python 구현과 개발용 Python 스크립트는 최종 앱 런타임에 포함하지 않는다.

## 현재 구현 범위

`desktop/`의 Tauri 개발 미리보기는 창, 트레이와 앱 자체의 자동 초기화·종료 및
상태 표시를 제공한다. 수동 서버 시작·중지 버튼과 포트 입력은 제거했다. `crates/codex-lb-server/`는 루프백 리스너를 소유하며,
중지 시간 초과 시 작업 핸들을 보존하고 중복 시작을 거절한다. 포트 충돌 시
다른 프로세스에 연결하거나 종료하지 않는다. 창 닫기는 숨김으로 처리하고,
앱 종료는 서버 정리를 기다린다.

`/health` 및 `/health/live` 응답은 원본 계약을 따른다. 데이터베이스와
업무 서비스가 아직 없으므로 `/health/ready`는 503이다. 계정·인증·실제
프록시·사용량 집계·데이터 이전은 아직 이식되지 않았다. 이 빌드는 실제
Codex 클라이언트의 연결 대상으로 사용할 수 없다.

## 호환성 기준 자료

`desktop/upstream.json`이 기준 커밋과 Rust-only 결정을 소유한다.
`scripts/desktop/source_inventory.py`는 작업 디렉터리의 변경된 코드 대신
그 커밋의 Git 객체를 읽어 다음 자료를 재현한다.

- 라우트 선언 202개. 이는 런타임에서 마운트된 엔드포인트 수가 아니다.
- 기능 명세 67개, 마이그레이션 파일 264개, 원본 Python 테스트 파일 506개.
- 프론트엔드 소스 파일 493개, Settings 클래스 필드 96개.
- 정적 해석으로 확정하지 못한 경로 표현식 3개는 null과 원문을 함께 보존한다.
- 라우터의 인증 의존성, 함수 인자·반환 타입, 등록 표현식을 보존한다.

전체 자료는 `desktop/compatibility/source-inventory.json`에 있다. 앱에는
집계와 기준 커밋만 전달한다. 소스 목록은 동작 호환성의 증거가 아니다.
각 라우트의 검증 상태는 아직 `not-verified`이며 실제 동작 비교로 갱신할
별도 증거 원장이 필요하다.

## 개발 실행

Rust 1.96.0은 원본 `rust-toolchain.toml`을 따른다. 셸에서 cargo를 찾지
못하면 `source "$HOME/.cargo/env"`를 실행한다.

```sh
python3 scripts/desktop/source_inventory.py --check
python3 -m unittest discover -s scripts/desktop -p 'test_*.py'
cargo test --locked --workspace
cargo clippy --locked -p codex-lb-server -p codex-lb-desktop --all-targets -- -D warnings
cd desktop
npm ci
npm run build:preview
```

예: 앱을 실행하면 내부 루프백 리스너가 자동으로 준비된다. 창을 닫아도
리스너는 유지되고, 트레이에서 ‘앱 종료’를 선택하거나 Cmd-Q를 누르면
정리된다. 원본 앱이 이미 2455를 사용 중이면 앱 안에 충돌 설명이 표시된다.
다른 프로세스를 종료하거나 자동으로 다른 포트에 연결하지 않는다.
해당 프로그램을 종료한 뒤 앱을 다시 실행하면 재시도한다.

화면의 ‘자동 실행’ 상태는 내부 리스너의 상태만 의미한다. 계정·사용량·설정
카드는 이식 예정 범위를 설명하며, 아직 동작하는 기능으로 표시하지 않는다.
개발용 라우트·마이그레이션 개수는 제품 화면에서 제거했으며 기존 호환성
목록 파일에 보존한다. 중복 실행은 기존 창을 표시하고 추가 리스너를 만들지 않는다.

## 남은 검증

2026-10-15 초기 기반 검증: Rust workspace 테스트 33개와 소스 목록 도구
테스트 5개 통과. 새 Rust 패키지의 Clippy 및 rustfmt 검사 통과. OpenSpec
변경 명세 검증 통과. macOS 개발 앱을 실행해 시작·중지 버튼, 창 닫기 후
`/health` 응답 유지, Cmd-Q 종료 후 포트 재바인드 가능 여부를 확인했다.
트레이 메뉴의 각 항목에 대한 UI 조작 검증은 아직 별도 수행하지 않았다.

원본 Rust 테스트는 로컬 fixture 기반 검증이며 실제 ChatGPT 계정의 동작
검증이 아니다. 원본 Python 테스트 전체와 React 흐름 테스트를 후보 Rust
서버에 연결한 비교 검증, 기존 데이터 이전, PostgreSQL, 인증과 권한,
모든 프록시 프로토콜 및 백그라운드 작업은 남아 있다.

배포 서명·공증·자동 업데이트는 미구현이며 생성한 앱은 개발 미리보기다.
원본 대비 완료된 분석 작업의 토큰·시간·CPU·프로세스군 최대 메모리는
측정하지 않았다. 아직 성능 또는 전체 호환성 개선을 주장하지 않는다.

다음 구현 순서는 설정과 암호화 저장소·스키마 호환을 먼저 확보하고,
계정과 OAuth, 라우팅과 프록시, 나머지 관리 API와 React 화면을 연결하는
것이다. 각 단계에서 기존 실패·취소·권한·세션 소유권 조건을 함께 검증한다.

## 자동 실행 변경 검증 (2026-10-15)

- 앱 초기화·충돌 진단 보존을 포함한 관련 Rust 테스트 7개 통과.
- 새 native 코드의 Clippy, rustfmt, 프론트엔드 JavaScript 구문 검사 통과.
- OpenSpec strict validation 및 macOS 앱 패키징 통과.
- 실제 앱을 열었을 때 조작 없이 자동 실행 상태와 `/health` 200 응답 확인.
- 두 번째 앱 실행 프로세스가 정상 종료하고 기존 인스턴스 응답이 유지됨을 확인.
- 테스트용 포트 점유 중 앱을 실행해, 화면 로딩 이후에도 충돌 이유와 복구 안내가
  표시됨을 확인. 테스트 앱과 테스트 리스너는 검증 후 종료했다.
- 기존 수동 서버 명령·포트 상태·호환성 통계 IPC를 제거했다. 전체 호환성
  원본 목록은 파일에 보존하며 실제 기능 이식 완료로 간주하지 않는다.

## 2026-10-15: 계정·사용량·HTTP 중계 구현

이 단계는 원본 전체 호환 완료와 별도로 검증하는 데스크톱 사용 흐름이다. 원본 Python 서비스/DB/사용자의 Codex 설정 파일은 변경하지 않는다.

- 계정: 사용자가 선택한 Codex auth.json의 snake_case/camelCase 토큰 필드 가져오기, 기기 코드 OAuth 로그인, 토큰 갱신, 계정 일시 정지/재개/연결 해제. OAuth URL/client ID와 refresh/device/code-exchange 계약은 pinned upstream의 `app/core/clients/oauth.py`, `app/core/auth/refresh.py`, `app/core/config/settings.py`를 참조한다. JWT 디코딩은 표시/라우팅 메타데이터이며 서명 검증이나 인증 성공의 증거로 취급하지 않는다.
- 저장: Tauri 앱 데이터 경로의 독립 `vault.bin`(AES-256-GCM), 별도 `vault.key`(0600), 임시 파일+fsync+rename. 요청 본문·출력·인증 토큰은 요청 기록에 남기지 않는다. 암호화 키가 같은 로컬 사용자 디렉터리에 있으므로 같은 OS 계정의 악성 코드까지 막는 Keychain 저장 방식은 아니다. Python Fernet/SQLite/PostgreSQL 저장소와의 교환/마이그레이션은 미구현이다.
- 사용량: 계정별 `/wham/usage` 명시적 조회, 관측 시각과 원본 quota payload 보존. 요청별 입력/출력/캐시 토큰을 terminal event에서 기록한다. 사용량 미제공은 null이다. 제공자 비용 산정, 자동 quota 스케줄러, 누적 장기 통계는 이 단계에 포함하지 않았다.
- 중계: loopback 2455, 생성된 로컬 bearer 키, `/v1/responses` 및 `/backend-api/codex/responses`, `/v1/responses/compact` 및 backend compact. 일반 응답은 upstream SSE terminal을 수집하고 스트리밍 응답은 chunk를 그대로 전달한다. 원본의 문자열 input 변환과 알려진 비지원 생성 필드 제거를 적용했다. 임의 클라이언트 헤더 전체 전달은 하지 않는다.
- 리소스: 요청 본문을 읽기 전에 인증/동시성 제한 적용, 8개 동시 요청, 16 MiB 요청/단일 SSE 프레임·compact 응답, 100계정, 최근500개 요청, 32 MiB 암호화 저장소. upstream 연결 10초/idle read90초, OAuth 교환30초. 이 제한은 데스크톱의 메모리·디스크 예산이며 원본 전체 계약의 제한이라고 주장하지 않는다.
- 라우팅: 활성 계정의 최근 보존 요청 수 기준 분배. 전송 후 자동 재시도/다른 계정 failover 없음. `previous_response_id`, `conversation`, 파일 참조는 앱이 제공하는 `x-codex-lb-account` 헤더 필수. 자동 affinity/원본 quota-aware balancer/reservation은 아직 이식 전이다.
- 소유권: HTTP stream body가 upstream/permit/기록 guard를 소유하고 drop 시 취소를 기록한다. refresh 작업은 service JoinSet에서 소유해 호출자 취소 후에도 토큰 저장을 마치며, 앱 종료 때 drain한다. 저장 실패 시 새 토큰을 메모리에 유지하고 다음 dispatch 전에 저장을 재시도한다. 시작 시 미완료 기록은 interrupted로 전환한다.

사용 예: 앱에서 계정을 연결 → 사용량 조회 → Responses 클라이언트 기본 주소를 `http://127.0.0.1:2455/v1`, API 키를 앱의 ‘연결 키 표시’ 값으로 지정한다. 대화 이어가기에는 계정 카드의 고정 헤더를 함께 보낸다. 기존 Codex 설정을 자동으로 수정하지 않는다.

검증: 신규11개 public-boundary workflow 테스트와 lifecycle7개 총18개 통과; Clippy `-D warnings`, JavaScript syntax, strict OpenSpec 통과. 추가 capacity/readiness 수정 전에는 기존 upstream28개를 포함한 전체44개 테스트도 통과했다. 테스트는 가짜 토큰과 loopback fixture 제공자를 사용했다. 실계정 로그인·Cloudflare/TLS 수용·실모델 generation은 검증하지 않았다. WebSocket, Chat Completions, 모델 카탈로그, 파일 업로드, 원본 dashboard/settings/권한/API전체 호환도 주장하지 않는다.

측정: 전체44개 테스트를 포함한 캐시가 있는 build/test 실행에서 wall15.63초, user38.36초, system5.30초, `/usr/bin/time -l` maximum RSS620,773,376 bytes를 관측했다. 이는 프로세스 패밀리 peak 합계가 아니며 앱 성능 수치도 아니다. 원본과 동등한 workflow의 cold/warm 비교, 토큰 비용, 앱 프로세스 패밀리 peak는 미측정이다.

패키지 검증: 최종 경로의 macOS .app 실행, 계정·요청 화면과 자동 중계 상태를 native UI로 확인했다. 인증 파일 선택창에서 가짜 잘못된 파일을 선택해 안전한 오류 표시와 빈 계정 유지까지 검증했다. 실행 앱의 /health/ready=200, 인증 없는 /v1/responses=401을 확인했다. 기존 앱/변경 소스는 `.local/backups/desktop-business-*`에 보존했다. 실제 사용자의 인증 파일은 열지 않았고 실제 로그인/제공자 호출도 하지 않았다.

## 2026-10-16: 원하는 브라우저에서 계정 로그인

기기 로그인 생성과 브라우저 열기를 분리했다. ‘계정 로그인’은 주소·코드·만료 시각을 표시하고 완료 상태를 조회한다. 사용자는 주소/코드를 복사해 Chrome 등 원하는 브라우저에서 인증하거나, 별도 ‘기본 브라우저로 열기’를 누를 수 있다. 열기 실패는 OAuth 취소로 이어지지 않는다. 복사 API가 거부되면 입력칸을 선택한 상태로 단축키 복사를 안내한다. 브라우저 열기는 UI에서 받은 임의 URL 대신 서비스가 소유한 유효한 pending flow의 verification URL을 사용한다.

검증: device authorization 통합 테스트(링크/코드 보존, 완료·취소 후 링크 사용 불가), Rust Clippy, JS syntax, strict OpenSpec 및 macOS 앱 빌드 통과.

## 2026-10-16: 앱에 원본 대시보드 내장

요청 범위는 원본 대시보드와 기존 Rust 요청 중계를 함께 제공하는 설치형 앱이다. 원본 React 통계 카드·계정 카드·사용량 패널·도넛 차트·요청 기록 표와 스타일을 별도 desktop entry로 번들링했다. 원격 문서 페이지를 표시하지 않으며 데이터는 Rust IPC에서 받는다. 5초마다 로컬 상태를 갱신하고 제공자 사용량은 명시적 조회를 유지한다. 로그인 링크/코드 복사, 인증 파일 가져오기, 계정 관리, 중계 연결 설정을 내부 화면에서 제공한다.

IPC 경계에서 Zod로 검증하고 provider의 primary 슬롯에 온 주간/월간 단독 한도는 기간에 맞는 표시 모델로 한 번 변환한다. 미제공 토큰/비용/한도는 null로 보존한다. 도넛은 관측 계정의 동일 가중 잔여율이며 플랜별 크레딧 합계가 아니다. 요청 통계는 앱이 보존하는 최근500건과 선택 기간 범위이다. 원본 전체 관리자 API·설정·warmup·장기 기록 호환은 주장하지 않는다. 구형 desktop/preview 화면은 새 entry로 대체해 제거한다.

검증: 실제 원본 컴포넌트와 모의 IPC를 사용한 테스트7개(잔여 한도·기록·검색·미제공 데이터·로그인 링크·계정 조작·주간/월간 정규화), frontend lint, desktop TypeScript 및 Tauri macOS 앱 빌드 통과. 번들43.14MiB; 주 JS chunk895kB에 대한 Vite 경고가 남아 있으며 런타임 성능 비교는 미측정이다. 새 generation을 실계정으로 실행하지 않았다.

최종 검증: strict OpenSpec 통과. 기존 앱을 백업 후 새 번들로 교체하고 native UI에서 대시보드·계정·연결 설정 탐색을 확인했다. 기존 두 계정과 마지막 quota 관측이 보존되었으며 주간 단독 한도가 주간 카드로 표시되고 중계가 자동 실행 중이다. 계정 삭제/새 generation/새 인증은 실행하지 않았다.

## 2026-10-16: 계정 잔여율 표시 보정

원인: 단일 도넛 중앙은 여러 계정의 평균이며, 계정별 범례는 평균에 대한 기여분(잔여율/계정수)을 표시했다. 최신 제공자 조회 시 계정 잔여49%,14%인데 중앙31.5 및 범례24.5,7이어서 실제 잔여율로 오인할 수 있었다. 이전 관측도 함께 남아 있었다. 계정별 독립 도넛(전체100)으로 대체해 비율을 나누지 않고 동일 원본 잔여율을 중앙·제목·범례에 표시하며 각 관측 시각과 수동 갱신 안내를 추가했다. 임의 보정 계수는 사용하지 않는다.

검증: 여러 계정63%,16% 표시와 갱신 후49% 교체를 포함한 frontend8개 테스트, lint, desktop 타입검사/빌드 및 strict OpenSpec 통과. 사용자 요청에 따라 앱에서 제공자 quota를 갱신해49%,14%를 관측했다. generation 요청은 실행하지 않았다.

## 2026-10-16: 연결 설정 화면 제거

사용자 요청에 따라 연결 설정 메뉴/화면, 키 표시 상태, 사용되지 않는 connection_key IPC를 제거했다. 내비게이션은 대시보드·계정으로 구성하고 과거 연결 경로는 대시보드로 표시한다. Rust 중계 자동 실행과 로그인 링크 복사는 유지한다. 사용량 조회 버튼을 ‘사용량 새로고침’으로 명확히 변경했다. frontend8개 테스트·lint·desktop 타입검사/빌드 및 strict OpenSpec 통과.

## 2026-10-16: 모니터링 중심 대시보드

대시보드의 계정 연결/관리 버튼, 중계 주소·연결 안내, Warm-up 등 비활성 조작을 제거했다. 계정 관리는 별도 계정 화면에서 유지한다. 대시보드가 표시되는 동안 5초 로컬 snapshot 갱신 시 오래된 활성 계정 quota를 순차 조회한다. 계정별 자동 시도 간격은 최소60초이며 2분 넘은 관측은 오래됨으로 표시한다. 실패는 이전 관측을 유지하며 계정별 오류를 표시하고 성공 시 제거한다. 잔여20% 이하 경고와 미래의 가장 빠른 초기화 시각을 표시한다. 알림은 앱 내 표시이며 OS 알림이나 백그라운드 조회는 포함하지 않는다.

검증: frontend9개 테스트(자동 조회·정지 계정 제외·오래된 관측·실패 보존 및 복구 포함), lint, TypeScript, macOS 앱 빌드, strict OpenSpec 통과. JS chunk885kB 경고는 기존 제한으로 남는다. 자동 조회 추가 비용은 활성 계정당 분당 최대1회 실패/성공 시도이며 loopback 테스트 외 실제 성능 비교는 미측정이다.

## 2026-10-16: macOS 메뉴 막대 계정 모니터

메뉴 막대에 계정번호별 잔여율을 표시하고 메뉴에 계정 이름·기간별 사용/잔여율·관측 시각·오래됨/오류를 표시한다. 상단은 최대4계정과 초과 개수로 크기를 제한하고 상세 메뉴는 모든 계정을 유지한다. 5초마다 snapshot에서 변경을 확인하고 표시가 바뀔 때만 메뉴를 재구성한다. 알 수 없는 quota는 —, 2분 초과 값은 ~, 조회 오류는 !로 표시한다. 메뉴에서 대시보드 열기/앱 종료가 가능하다.

창이 닫히거나 최소화된 동안은 Rust monitor가 활성 계정의 60초 이상 된 quota를 순차 조회한다. 화면 표시 중에는 기존 dashboard 조회가 유지된다. background 작업은 DesktopState가 handle을 소유하며 종료 시작 시 중단하고 종료 실패 시 다시 시작한다. 제공자 credentials refresh 작업은 기존 service가 소유한다. 데이터는 기존 암호화 저장소를 사용한다.

검증: 계정별 비율/unknown·오류/100계정 메뉴와 제목 제한 테스트3개, Clippy -D warnings, rustfmt, strict OpenSpec, macOS 앱 빌드 통과. 변경 후 번들43.47MiB. 실제 앱 성능과 프로세스 패밀리 CPU/메모리 비교는 미측정이다.

## 2026-10-16: 메뉴 막대 색상·토큰 아이콘

계정번호를 색상 원(파랑·녹색·보라·주황 등)으로 바꾸고 잔여 접두어를 토큰 모양 🪙로 교체했다. 상세 메뉴도 동일 순서의 색상을 계정 이름 옆에 표시한다. 상단은 최대4개 계정이며 계정별 색상은 현재 계정 순서에 따른다. 계정 추가/제거 시 색상 영구 고정 설정은 제공하지 않는다. 미확인/오래됨/오류 표시와 기존 백그라운드 조회는 유지한다. 기존3개 회귀 테스트의 제목·상세 색상 대응 검증, Clippy -D warnings, rustfmt, strict OpenSpec, macOS 앱 빌드 통과.

## 2026-10-16: 중계 제거 및 모니터링 전용 전환

최신 사용자 요구사항으로 기존 중계 유지 범위를 폐기했다. Tauri 시작 시 Server/AppRuntime 생성·포트 바인딩을 제거하고 계정 Service와 메뉴 막대 monitor만 실행한다. 중계 lifecycle 모듈과 application_status IPC를 제거했다. UI의 요청·입출력 토큰·비용·오류율 통계, 기간 필터, 요청 기록, 계정 상세의 요청 통계·고정 헤더를 제거했다. desktop IPC도 계정 snapshot과 저장 상태만 노출하며 요청 기록을 보내지 않는다. 관련 파싱/변환/필터 함수도 삭제했다.

기존 원본 서비스 라이브러리 소스와 vault 내부 사용자 기록은 보존한다. 현재 데스크톱에서 해당 HTTP server를 시작하는 경로는 없다. 로그인·계정 관리·quota조회·색상 메뉴 막대 및 닫힌 창의 백그라운드 quota 조회는 유지한다.

검증: frontend9개 테스트(통계/요청 기록 부재, lifecycle IPC 호출 부재 및 quota/login/계정 조작 유지), Clippy -D warnings, TypeScript, strict OpenSpec 및 macOS 앱 빌드 통과. 번들40.36MiB (이전43.47MiB); 주 JS747kB (이전885kB). 이는 파일 크기 비교이며 런타임 성능 비교는 미측정이다.

최종 native UI에서 중계 통계·요청 기록·계정 고정 헤더 부재와 실제 계정 quota 자동 갱신을 확인했다. 새 앱 실행 중 127.0.0.1:2455 연결이 ECONNREFUSED(61)여서 listener가 없는 것도 확인했다.
