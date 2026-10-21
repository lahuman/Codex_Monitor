# GitHub 공개·릴리스 안내

> 기준 명세: [desktop-release](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/desktop-release/spec.md), [monitor-documentation](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/monitor-documentation/spec.md)

## 저장소 소개 문구

GitHub의 About 설명에 사용할 수 있는 문구입니다.

> Codex 계정별 잔여 한도와 초기화권 만료일을 확인하는 Rust·Tauri 기반 macOS·Windows·Android 모니터링 앱. codex-lb에서 출발한 파생 프로젝트.

영문:

> A Rust/Tauri desktop and Android dashboard for Codex account quotas and reset-voucher expiry dates, derived from codex-lb.

주제 태그 후보: `codex`, `tauri`, `rust`, `macos`, `windows`, `desktop`, `usage-monitor`, `dashboard`.

## 게시할 소스와 문서

첫 진입점은 루트 README입니다. 원본은 `README.upstream.md`, 기능·개발·출처 문서는 `docs/monitor/`, 구현 계약은 `openspec/`에서 관리합니다. MIT 고지와 원본 기여자 목록을 함께 보존합니다.

`desktop/src-tauri/icons/`는 앱에 필요한 아이콘 자산입니다. `target/`, `node_modules/`, `desktop/dashboard-dist/`, `desktop/releases/`, `.local/`은 소스 커밋 대상과 구분합니다. DMG·ZIP은 GitHub Releases의 바이너리 첨부물로 게시합니다. 앱 데이터·토큰·키 파일과 실계정 정보가 있는 스크린샷은 포함하지 않습니다. README는 실제 계정 화면 대신 앱 아이콘을 사용합니다.

이 저장소에는 원본 서비스의 CI·릴리스 워크플로, Python 패키지 설정과 기존 정책 문서도 남아 있습니다. 원본 서비스용 보안 정책의 연락처·지원 버전 표를 Codex Monitor의 지원 약속으로 옮겨 해석하지 않습니다. `CHANGELOG.md`도 상속된 원본 서비스의 릴리스 기록입니다. 앱의 변경 계약은 OpenSpec의 모니터링·데스크톱 항목을 참고합니다. 이들이 Codex Monitor의 DMG를 자동 배포한다고 설명하지 않습니다. 데스크톱 배포는 별도의 `Desktop release` 워크플로를 사용합니다.

## 로컬 릴리스 생성

```sh
cd desktop
npm run package:macos
```

현재 버전 `0.1.21`의 Apple Silicon 결과 경로 예:

```text
desktop/releases/0.1.21/macos-arm64/
├── Codex-Monitor-0.1.21-macos-arm64.dmg
├── Codex-Monitor-0.1.21-macos-arm64.zip
├── SHA256SUMS.txt
└── release.json
```

배포 폴더에는 압축을 푼 `.app`을 보관하지 않습니다. DMG·ZIP 검증과 출력 확정 후 패키징 중간 사본과 빌드 `.app`을 정리합니다. 개발용으로 앱만 필요하면 `desktop`에서 `npm run build`를 실행하세요. 설치된 앱이나 사용자가 열어 둔 DMG는 건드리지 않습니다.

DMG에는 `설치하기.pkg`도 포함됩니다. macOS Installer의 진행 막대·완료 화면을 사용하는 선택 경로이며, 앱 번들만 `/Applications`에 설치합니다. 패키지 재배치 검색과 사용자 정의 설치 스크립트는 비활성화합니다. PKG는 미서명이며 `release.json`의 `installer` 항목에 구분해 기록합니다.

생성기는 실제 Mach-O 아키텍처와 앱 메타데이터를 확인합니다. `0.1.1`부터 원본·복사본·ZIP 재추출·읽기 전용 DMG 내부 앱의 전체 서명을 `codesign --verify --deep --strict`로 검사하며, 실패하면 산출물을 확정하지 않습니다. `release.json`에 서명 종류·공증 티켓·Gatekeeper 판정을 구분해 기록합니다. 자체 서명은 공증이나 Gatekeeper 승인을 뜻하지 않습니다. 버전 기준은 `desktop/src-tauri/tauri.conf.json`입니다. 같은 출력 폴더가 있으면 자동으로 덮어쓰지 않습니다. 기존 산출물을 보존하거나 버전을 갱신한 뒤 다시 패키징합니다.

체크섬 확인은 해당 출력 폴더에서:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

## macOS·Windows 통합 GitHub Releases

최신 소스가 `main`에 반영되면 **Desktop release** 워크플로가 Windows x64와 macOS Apple Silicon을 각각 테스트·패키징합니다. Actions에서 **Run workflow → main**으로 직접 시작할 수도 있습니다. 두 작업이 모두 성공해야 **Publish macOS and Windows prerelease**가 같은 실행의 파일을 하나의 `desktop-v<버전>` 릴리스로 공개합니다.

현재 버전 예시:

```text
desktop-v0.1.21 (Pre-release)
├── Codex-Monitor-0.1.21-macos-arm64.dmg
├── Codex-Monitor-0.1.21-macos-arm64.zip
├── Codex-Monitor-0.1.21-windows-x64-setup.exe
├── SHA256SUMS-macos-arm64.txt
├── SHA256SUMS-windows-x64.txt
├── release-macos-arm64.json
└── release-windows-x64.json
```

Mac 빌드는 `macos-15`의 arm64 실행 환경을 확인한 뒤 진행합니다. Intel Mac 또는 Windows ARM64 네이티브 배포를 의미하지 않습니다. 한 플랫폼의 빌드 실패, 버전·체크섬 불일치 또는 파일 누락이 있으면 새 통합 릴리스를 공개하지 않습니다. 두 플랫폼의 Actions Artifact도 각각 30일 유지됩니다.

초안에 일곱 파일을 올리고 서버의 체크섬까지 검증한 뒤 **Pre-release**로 공개하며 Latest 정식 배포로 지정하지 않습니다. 같은 커밋의 재실행은 안전하게 이어서 처리하지만, 공개된 버전의 태그·파일을 다른 커밋의 파일로 교체하지는 않습니다. 새 변경사항을 배포하려면 데스크톱 버전을 갱신합니다. 기존 Windows 전용 릴리스는 그대로 보존합니다.

릴리스 본문에는 두 플랫폼의 서명 상태와 macOS 공증·Gatekeeper 결과를 표시합니다. 현재 자체 서명·미공증 Mac 앱에는 보안 경고가 표시될 수 있고 Windows 서명도 구성되지 않았습니다. 실제 PC의 설치·제거·업데이트·로그인을 검증한 뒤 정식 배포 여부를 판단하세요. Mac 사용자는 DMG의 **먼저 읽어주세요.html**에서 설치 가이드를 확인합니다.

소스·워크플로를 커밋·푸시한 뒤 실제 GitHub 실행으로 확인합니다. 로컬 테스트와 명세 검증만으로 원격 릴리스 업로드 성공을 주장하지 않습니다.

[개발 안내](development.md) · [문서 목록](index.md)


## Windows 빌드와 소개 페이지

- [Windows 네이티브 빌드·설치 파일](windows.md): `Desktop release`가 두 운영체제 파일을 공통 Releases에 등록하고 플랫폼별 Artifact도 보존합니다.
- [GitHub Pages](website.md): `Project website and docs` 워크플로가 소개 페이지와 참조 문서를 하나의 Pages artifact로 배포합니다. 저장소 Settings → Pages → Source는 **GitHub Actions**로 선택합니다.
- 원본 Python 제품의 CI·릴리스·라벨 관리 워크플로는 `github.repository == 'Soju06/codex-lb'` 조건으로 원본 저장소에서만 실행되도록 보존합니다. 이 포크의 배포 워크플로는 통합 데스크톱 빌드·릴리스와 소개 페이지·문서 배포입니다.
- 업로드 전 검토한 소스와 아이콘만 커밋하고 `.local/`, `target/`, `desktop/releases/`, 앱 데이터 디렉터리는 포함하지 않습니다. GitHub 업로드는 명시적으로 승인된 작업에서 진행하고, Pages 설정은 저장소의 GitHub Actions 소스를 사용합니다.

Mac 설치 실패 시 [서명·호환성 진단 안내](macos-installation.md)를 사용하세요. DMG에는 읽기 전용 진단 스크립트도 포함됩니다.

## Pre-release를 정식 릴리스로 전환 {#stable-release}

1. [Releases](https://github.com/lahuman/Codex_Monitor/releases)에서 설치 테스트를 마친 버전을 선택하고 **Edit**(연필 아이콘)을 누릅니다. 저장소 쓰기 권한이 필요합니다.
2. **This is a pre-release** 체크를 해제합니다.
3. 최신 권장 배포로 지정하려면 **Set as latest release**를 선택합니다.
4. **Update release**를 누릅니다.

태그와 기존 DMG·ZIP·EXE를 그대로 유지하므로 다시 빌드하거나 업로드할 필요가 없습니다. 새 버전은 자동화가 Pre-release로 생성합니다. 같은 커밋으로 재실행할 때 이미 공개된 파일이 모두 일치하면 정식 릴리스 상태를 되돌리지 않습니다. 코드가 달라졌다면 버전을 올려 새 릴리스로 배포합니다.

참고: [GitHub 릴리스 관리](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).


## 0.1.21 소스와 Android 미리보기

이번 소스 반영에는 Android 독립 계정 연결, 인증 복원, 배터리를 고려한 수집, 모바일 카드 대시보드와 반응형 홈 위젯, 데스크톱 가독성 통일 및 기능 명세·예시 화면이 포함됩니다. 네이티브 Android 프로젝트와 Gradle wrapper는 빌드 소스이며, 개인 SDK 경로·서명 키·계정 데이터·중간 APK는 커밋하지 않습니다. [전체 작업·검증 정리](releases.md)를 참고하세요.

기존 `android-v0.1.21-preview`는 이미 공개된 APK 미리보기입니다. 과거 태그는 당시 기준 커밋을 가리키므로 자동 생성 Source code ZIP이 해당 APK 전체 소스와 같다고 해석하지 않습니다. 이번 소스 커밋과 새 `desktop-v0.1.21`은 일치하며, 새 데스크톱 릴리즈는 커밋된 소스로 Windows·macOS를 각각 재빌드합니다. 기존 Android APK·태그는 교체하지 않습니다. Android APK는 [Android 미리보기 릴리즈](https://github.com/lahuman/Codex_Monitor/releases/tag/android-v0.1.21-preview)에서 받습니다.
