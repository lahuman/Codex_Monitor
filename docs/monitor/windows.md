# Windows 설치와 빌드

> 기능 계약: [desktop-release](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/desktop-release/spec.md)

## 대상과 현재 검증 범위

Windows 10 / 11 **x64**를 대상으로 합니다. 같은 React 대시보드와 Rust 계정 서비스를 사용하며, Windows 전용 NSIS 설치 파일과 ICO 아이콘을 구성했습니다. Windows 네이티브 CI에서 기존 빌드가 성공한 기록을 확인했습니다. 새 통합 게시 작업의 GitHub 실행과 **실제 PC의 설치·로그인·트레이 검증은 아직 확인이 필요**합니다. 이 문서의 명령과 워크플로 준비가 Windows 실행 검증 완료를 뜻하지 않습니다. ARM64 Windows 네이티브 빌드는 제공하지 않습니다.

## GitHub에서 설치 파일 받기

1. 소스를 저장소의 `main`에 올리면 `Desktop release` 워크플로가 관련 변경에서 실행됩니다. Actions → **Desktop release** → **Run workflow**에서 `main`을 선택해 수동 실행할 수도 있습니다.
2. Windows x64와 macOS Apple Silicon의 테스트·패키징이 모두 성공하면 **Publish macOS and Windows prerelease** 작업이 같은 실행의 두 운영체제 파일을 받아 **Releases**에 자동 등록합니다. 태그는 `desktop-v<버전>`이며 **Pre-release**로 표시됩니다. PR·다른 브랜치·다른 저장소의 실행은 공개하지 않습니다.
3. Releases에서 `.exe`와 `SHA256SUMS-windows-x64.txt`를 받아 해시를 대조합니다. 메타데이터는 `release-windows-x64.json`입니다. Actions의 **Codex-Monitor-windows-x64** Artifact도 30일간 유지되며, 이 ZIP 안에서는 기존 이름 `SHA256SUMS.txt`, `release.json`을 사용합니다. Artifact 다운로드에는 GitHub 로그인이 필요할 수 있습니다.

```powershell
Get-FileHash .\Codex-Monitor-0.1.10-windows-x64-setup.exe -Algorithm SHA256
```

4. `Codex-Monitor-<버전>-windows-x64-setup.exe`를 실행합니다. 현재 사용자 범위로 설치하며 한국어·영어 설치 언어를 선택할 수 있습니다.
5. WebView2가 필요하면 설치 프로그램이 Microsoft 부트스트래퍼를 내려받습니다. 최초 설치 시 인터넷이 필요할 수 있습니다. 런타임을 건너뛰는 구성은 사용하지 않습니다.
6. 앱에서 계정 연결 후 대시보드를 엽니다. 원하는 브라우저로 로그인 링크를 복사할 수 있습니다.

코드 서명 인증서는 구성하지 않았습니다. 서명된 공식 배포로 소개하지 않으며 Windows SmartScreen의 인식 여부는 별도입니다. 자동 등록된 Pre-release는 실제 PC 설치 검증 완료를 뜻하지 않습니다. 정식 배포로 전환하기 전 Windows PC에서 설치·제거·업데이트를 확인하세요.

## 소스에서 빌드

필요한 도구:

- Windows 10 / 11 x64
- Microsoft C++ Build Tools의 **Desktop development with C++**, MSVC x64 컴파일러와 Windows SDK
- Microsoft Edge WebView2 Runtime
- 저장소 `rust-toolchain.toml`의 Rust 1.96.0 / `x86_64-pc-windows-msvc`
- Node.js 22.12 이상(또는 20.19 이상인 20.x), Bun 1.3.14
- NASM: `aws-lc` 네이티브 암호화 라이브러리 빌드에 필요하며 PATH에서 사용할 수 있어야 합니다.

PowerShell에서 저장소 루트를 기준으로 실행합니다.

```powershell
git clone https://github.com/lahuman/Codex_Monitor.git
cd codex_Monitor
rustup target add x86_64-pc-windows-msvc
bun install --cwd frontend --frozen-lockfile
npm ci --prefix desktop
npm --prefix desktop run dev
```

배포용 설치 파일 생성:

```powershell
npm --prefix desktop run package:windows
```

명령은 아이콘을 생성하고, 최적화 x64 앱을 빌드한 뒤 실제 앱의 PE/COFF 아키텍처를 검사합니다. NSIS 설치 파일만 선택해 버전별 폴더에 복사하고 SHA-256과 메타데이터를 기록합니다. 작업 트리나 계정 데이터는 패키징하지 않으며 이미 있는 릴리스 폴더를 덮어쓰지 않습니다.

```text
desktop/releases/0.1.10/windows-x64/
├── Codex-Monitor-0.1.10-windows-x64-setup.exe
├── SHA256SUMS.txt
└── release.json
```

## 확인 항목

`desktop-windows.yml`은 잠긴 의존성 설치, 대시보드 빌드, 패키징 계약 테스트, 저장소·데스크톱 Rust 테스트, UI 테스트, NSIS 빌드와 artifact 업로드를 수행합니다. 테스트가 실패하면 배포 artifact를 업로드하지 않습니다.

실제 PC에서는 다음을 확인해야 합니다.

- 설치·제거, 기존 설치 위 업데이트, WebView2가 없는 환경의 설치
- 계정 로그인·반복 저장·앱 재시작 후 계정/이력 유지
- 창 닫기 → 알림 영역 아이콘 유지 → 대시보드 다시 열기 → 앱 종료
- 툴팁과 메뉴의 여러 계정 잔여율, 오래된 값·조회 실패 표시
- 밝은/어두운 테마와 디스플레이 배율

Windows는 트레이 제목 문자열을 표시하지 않으므로, macOS의 상시 텍스트 대신 아이콘·툴팁·메뉴를 사용합니다.

참고: [Tauri Windows 설치 파일](https://v2.tauri.app/distribute/windows-installer/) · [Tauri 전제 조건](https://v2.tauri.app/start/prerequisites/)

## Releases 자동 등록과 재실행

빌드 작업은 읽기 권한을 유지하고, 성공한 `main` 빌드의 별도 공개 작업만 `contents: write`를 사용합니다. 별도 개인 토큰을 저장할 필요 없이 Actions의 기본 토큰을 사용합니다. 조직 정책·태그 규칙이 쓰기를 막는 경우에는 해당 정책에 맞는 권한 검토가 필요합니다.

등록 전 설치 파일 이름·크기·SHA-256, 체크섬 문서, 버전·제품·x64 타깃을 확인합니다. 현재 `main` 커밋에 공통 경량 태그를 만들고 초안 릴리스에 Windows 세 파일과 macOS 네 파일을 올린 뒤, 업로드한 바이트까지 검증된 경우에만 Pre-release로 공개합니다. 같은 버전의 Mac 배포 자산과 이름이 충돌하지 않도록 문서 자산에 Windows 접미사를 붙입니다. Latest 정식 릴리스로 지정하지 않습니다.

같은 커밋으로 재시도하면 부분 업로드된 초안을 이어서 완성하거나, 이미 완성된 릴리스를 검증하고 종료합니다. 태그가 다른 커밋을 가리키거나 자산 내용이 다르면 기존 파일을 교체하지 않습니다. 이때 데스크톱 버전을 올린 뒤 빌드해야 합니다. 빌드 도중 `main`이 갱신됐다면 새 커밋의 빌드를 사용합니다.

빌드가 초록색이어도 공개 작업이 실패하면 Releases는 생성되지 않거나 초안으로 남을 수 있습니다. **Publish macOS and Windows prerelease** 로그를 확인하세요. 로컬 워크플로 수정은 GitHub의 `main`에 커밋·푸시한 뒤 실행되는 빌드부터 적용됩니다.

기존 Windows 전용 태그·릴리스는 보존하며, 새 빌드부터 공통 `desktop-v<버전>` 릴리스를 사용합니다. 같은 버전의 macOS DMG·ZIP은 해당 릴리스의 Assets에서 함께 받을 수 있습니다.

0.1.11부터 NSIS 시작·완료 화면의 사이드바와 상단에 Codex Monitor 브랜드 이미지를 적용하고, 설치 파일의 홈페이지를 `https://lahuman.github.io/Codex_Monitor/`로 지정합니다. 실제 Windows 설치 화면과 홈페이지 링크는 Windows 빌드 후 PC에서 확인해야 합니다.
