# Codex Monitor

[프로젝트 소개](../README.md) · [기능 설명](../docs/monitor/features.md) · [개발 안내](../docs/monitor/development.md) · [출처와 크레딧](../docs/monitor/provenance.md)

계정별 잔여 한도, 초기화권 수량·만료일과 사용 이력을 표시하는 macOS 데스크톱 앱입니다. 창을 닫아도 메뉴 막대에서 모니터링을 계속합니다.

제품 이름·아이콘·배포 규칙은 [desktop-release 명세](../openspec/specs/desktop-release/spec.md)와 [빌드 안내](../openspec/specs/desktop-release/context.md)를 따릅니다.

## 준비와 실행

Rust, Xcode Command Line Tools, Node.js와 `frontend/package.json#packageManager`의 Bun이 필요합니다. 대상 시스템은 macOS 13.3 이상입니다.

```sh
cd frontend
bun install --frozen-lockfile
cd ../desktop
npm ci
npm run dev
```

## 배포 파일 생성

```sh
cd desktop
npm run package:macos
```

아이콘은 패키징 전에 자동 재생성됩니다. 최적화 앱은 `target/release/bundle/macos/Codex Monitor.app`에 생성됩니다. DMG·ZIP·SHA256SUMS.txt·release.json과 앱 사본은 `desktop/releases/0.1.0/macos-arm64/`에 생성됩니다. 경로의 버전은 Tauri 설정에서, 아키텍처는 실제 빌드된 실행 파일에서 가져옵니다. Intel Mac에서 빌드하면 `macos-x86_64`로 구분합니다. 현재 검증한 대상은 Apple Silicon입니다.

DMG를 열고 앱을 Applications 폴더로 드래그해 설치합니다. 교체 전 실행 중인 앱을 종료하세요. 기존 릴리스 폴더는 자동으로 덮어쓰지 않습니다. 다시 패키징할 때는 기존 산출물을 보존하거나 설정의 버전을 변경하세요.

`npm run build`는 앱만, `npm run build:preview`는 개발용 앱을 생성합니다. 아이콘 원본은 `branding/icon.svg`이며 `npm run icons`로 macOS용 크기를 재생성합니다. 앱 이름과 버전의 기준은 `src-tauri/tauri.conf.json`입니다.

이름 변경 후에도 기존 bundle identifier를 유지하므로 계정과 모니터링 데이터는 그대로 이어집니다. 서명·공증은 별도 배포 설정으로 관리하며, 이 작업은 이전 보안 검수 항목을 해결한 릴리스로 표시하지 않습니다.


## Windows x64

[Windows 전제 조건·설치·검증](../docs/monitor/windows.md)을 먼저 확인하세요.

```powershell
npm --prefix desktop run package:windows
```

Windows x64에서 실행하며, 결과는 `desktop/releases/<버전>/windows-x64/`에 생성됩니다. macOS에서 Windows 설치 파일을 생성하는 명령이 아닙니다.
