<p align="center"><img src="desktop/src-tauri/icons/128x128.png" width="96" alt="Codex Monitor 아이콘" /></p>

# Codex Monitor

**여러 Codex 계정의 잔여 한도와 초기화권을 한곳에서 확인하는 데스크톱 앱입니다.**

한국어 | [English](README.en.md)

[Soju06/codex-lb](https://github.com/Soju06/codex-lb)의 소스와 대시보드에서 출발해, 계정 모니터링에 집중하도록 Rust·Tauri 기반 설치형 앱으로 구성했습니다. 원본 프런트엔드의 UI 기반을 활용하고, 계정 서비스·자동 조회·메뉴 막대·로컬 이력·배포 구성을 추가했습니다. [모티브와 코드 출처](docs/monitor/provenance.md)

## 주요 기능

| 기능 | 제공 내용 |
| --- | --- |
| 계정별 한도 | 제공자가 반환한 기간별 잔여율, 초기화 예정 시각과 계정 플랜 |
| 초기화권 | 수량·만료일·남은 기간, 7일 미만 주의 / 24시간 이하 만료 임박 경고 |
| 메뉴 막대·트레이 | macOS는 별명·잔여율 두 줄과 빠른 보기, Windows는 아이콘·툴팁·메뉴로 확인; 창을 닫아도 조회 유지 |
| 자동·수동 조회 | 계정당 자동 조회 시도 간격 최소 60초, 새로고침 버튼 제공 |
| 사용 이력 | 최근 24시간 잔여 한도 그래프와 비교 가능한 약 1시간 감소량 |
| 상태·알림 | 정상·부족·소진·미확인·정지 구분, 계정별 앱 내 한도 부족 알림 |
| 계정 관리 | 기기 코드 로그인, 로그인 주소·코드 복사, auth.json 가져오기, 일시 정지·연결 해제 |
| 화면 | 밝은/어두운 테마, 간결한 차트 범례, 앱 이름·버전 정보 |

대시보드는 **한도 관측값**을 표시합니다. 그래프의 감소량은 토큰 수나 비용이 아닌 퍼센트포인트(%p)입니다. 알 수 없는 값을 0으로 간주하지 않습니다. [표시 항목 설명](docs/monitor/features.md)

## 지원 상태

| 대상 | 상태 |
| --- | --- |
| macOS Apple Silicon | 앱 실행과 DMG·ZIP 패키징 검증 완료 |
| macOS Intel | 빌드 경로는 있으나 실행·설치 미검증, 이 작업에서 바이너리 미생성 |
| Windows 10 / 11 x64 | NSIS 설치 파일 빌드·테스트 자동화 준비; 네이티브 CI 실행과 실제 PC 검증 대기 |
| Linux | 현재 배포 파일과 실행 검증 없음 |

현재 앱 버전은 **0.1.10**, macOS 최소 시스템 설정은 **13.3**입니다. `0.1.1`부터 앱 전체 자체 서명(Ad-hoc)을 적용합니다. Developer ID 서명·Apple 공증은 미적용이며 첫 실행 시 macOS 승인이 필요할 수 있습니다. [Mac 설치 문제 확인](docs/monitor/macos-installation.md)

## 설치와 시작

[프로젝트 소개 페이지](https://lahuman.github.io/codex_Monitor/)는 GitHub Pages 배포 후 제공됩니다. Windows 사용자는 [설치·빌드 안내](docs/monitor/windows.md)를 참고하세요.

[Releases](https://github.com/lahuman/codex_Monitor/releases)에 배포 파일이 게시된 경우, 사용하는 아키텍처의 DMG 또는 ZIP을 받습니다. 현재 로컬에서 생성한 파일은 `desktop/releases/<버전>/macos-<아키텍처>/`에 있습니다.

1. 실행 중인 이전 앱을 종료합니다.
2. DMG를 열고 **Codex Monitor**를 **Applications** 폴더로 드래그합니다. ZIP은 압축을 풀어 앱을 복사합니다.
3. 앱의 **계정** 화면에서 계정을 연결합니다. 로그인 주소를 복사해 Chrome 등 원하는 브라우저에서 인증할 수 있습니다.
4. 대시보드에서 사용량을 새로고침합니다. 이후 자동 조회가 이어집니다.

## 소스에서 실행·빌드

아래 명령은 macOS 기준입니다. Windows 전제 조건과 설치 파일 생성은 [Windows 안내](docs/monitor/windows.md)에 있습니다.

Rust 1.96.0, Node.js 22.12 이상(또는 20.19 이상인 20.x), Bun 1.3.14, Xcode Command Line Tools가 필요합니다. 앱 실행에 Python 서버나 Docker는 필요하지 않습니다.

```sh
git clone https://github.com/lahuman/codex_Monitor.git
cd codex_Monitor
cd frontend
bun install --frozen-lockfile
cd ../desktop
npm ci
npm run dev
```

macOS 배포 파일 생성:

```sh
cd desktop
npm run package:macos
```

아이콘을 재생성하고 최적화 앱·DMG·ZIP·SHA-256 체크섬을 만듭니다. 기존 릴리스 폴더는 덮어쓰지 않습니다. [개발·구조·테스트](docs/monitor/development.md) · [GitHub 게시 안내](docs/monitor/publishing.md)

## 프로젝트 범위와 문서

현재 배포 앱의 범위는 계정 모니터링입니다. 요청 중계, 로드밸런싱, 프록시 API 키 관리, 모델 생성 요청은 제공 기능에 포함되지 않으며, 초기화권을 사용하는 버튼도 구현하지 않았습니다.

저장소에는 원본 서비스의 Python 코드와 문서가 함께 남아 있습니다. 기본 데스크톱 빌드에서는 `legacy-relay` 기능을 활성화하지 않습니다. 원본 서버의 Docker·프록시 설정은 [보존한 원본 README](README.upstream.md)에서 확인할 수 있습니다.

- [문서 시작](docs/monitor/index.md)
- [기능과 지표 설명](docs/monitor/features.md)
- [개발 환경·아키텍처·테스트](docs/monitor/development.md)
- [모티브·재사용 코드·크레딧](docs/monitor/provenance.md)
- [Windows 설치·빌드](docs/monitor/windows.md) · [GitHub Pages 배포](docs/monitor/website.md)
- [GitHub 공개·릴리스 작성](docs/monitor/publishing.md)
- [변경 명세](openspec/specs/monitor-documentation/spec.md)

## 라이선스와 크레딧

[MIT License](LICENSE)를 따르며 원본의 `Copyright (c) 2025 Soju06` 고지를 보존합니다. 원본 기여자 목록은 [README.upstream.md](README.upstream.md)에 그대로 남겨 두었습니다.

대시보드 모티브는 **codex-lb**, 에디토리얼 스타일은 사용자가 제공한 **Claude.com 디자인 참고 자료**, 리팩토링 원칙은 **Cursor pstack**을 참고했습니다. 각 자료의 역할과 직접 재사용 여부는 [출처 문서](docs/monitor/provenance.md)에 구분했습니다. OpenAI·Anthropic·Cursor의 공식 제품이나 제휴 프로젝트를 의미하지 않습니다.
