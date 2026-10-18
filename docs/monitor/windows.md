# Windows 설치와 빌드

> 기능 계약: [desktop-release](https://github.com/lahuman/codex_Monitor/blob/main/openspec/specs/desktop-release/spec.md)

## 대상과 현재 검증 범위

Windows 10 / 11 **x64**를 대상으로 합니다. 같은 React 대시보드와 Rust 계정 서비스를 사용하며, Windows 전용 NSIS 설치 파일과 ICO 아이콘을 구성했습니다. 현재 Mac에서 코드·공유 테스트를 확인했으며, **Windows 네이티브 CI 실행과 실제 PC의 설치·로그인·트레이 검증은 대기 중**입니다. 이 문서의 명령과 워크플로 준비가 Windows 실행 검증 완료를 뜻하지 않습니다. ARM64 Windows 네이티브 빌드는 제공하지 않습니다.

## GitHub에서 설치 파일 받기

1. 소스를 저장소의 `main`에 올리면 `Windows desktop` 워크플로가 관련 변경에서 실행됩니다. Actions → **Windows desktop** → **Run workflow**로 수동 실행할 수도 있습니다.
2. 성공한 실행의 Artifacts에서 **Codex-Monitor-windows-x64**를 받습니다. Artifacts 다운로드에는 GitHub 로그인이 필요할 수 있습니다. 보존 기간은 30일입니다.
3. 압축을 풀고 `SHA256SUMS.txt`의 값과 설치 파일을 대조합니다.

```powershell
Get-FileHash .\Codex-Monitor-0.1.9-windows-x64-setup.exe -Algorithm SHA256
```

4. `Codex-Monitor-<버전>-windows-x64-setup.exe`를 실행합니다. 현재 사용자 범위로 설치하며 한국어·영어 설치 언어를 선택할 수 있습니다.
5. WebView2가 필요하면 설치 프로그램이 Microsoft 부트스트래퍼를 내려받습니다. 최초 설치 시 인터넷이 필요할 수 있습니다. 런타임을 건너뛰는 구성은 사용하지 않습니다.
6. 앱에서 계정 연결 후 대시보드를 엽니다. 원하는 브라우저로 로그인 링크를 복사할 수 있습니다.

코드 서명 인증서는 구성하지 않았습니다. 서명된 공식 배포로 소개하지 않으며 Windows SmartScreen의 인식 여부는 별도입니다. 공개 Releases에 파일을 올리기 전 실제 Windows PC의 설치와 제거를 확인하세요.

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
git clone https://github.com/lahuman/codex_Monitor.git
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
desktop/releases/0.1.9/windows-x64/
├── Codex-Monitor-0.1.9-windows-x64-setup.exe
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
