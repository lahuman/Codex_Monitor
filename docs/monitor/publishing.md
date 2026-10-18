# GitHub 공개·릴리스 안내

> 기준 명세: [desktop-release](https://github.com/lahuman/codex_Monitor/blob/main/openspec/specs/desktop-release/spec.md), [monitor-documentation](https://github.com/lahuman/codex_Monitor/blob/main/openspec/specs/monitor-documentation/spec.md)

## 저장소 소개 문구

GitHub의 About 설명에 사용할 수 있는 문구입니다.

> Codex 계정별 잔여 한도와 초기화권 만료일을 확인하는 Rust·Tauri 기반 macOS 모니터링 앱. codex-lb에서 출발한 파생 프로젝트.

영문:

> A Rust/Tauri macOS dashboard for Codex account quotas and reset-voucher expiry dates, derived from codex-lb.

주제 태그 후보: `codex`, `tauri`, `rust`, `macos`, `desktop`, `usage-monitor`, `dashboard`.

## 게시할 소스와 문서

첫 진입점은 루트 README입니다. 원본은 `README.upstream.md`, 기능·개발·출처 문서는 `docs/monitor/`, 구현 계약은 `openspec/`에서 관리합니다. MIT 고지와 원본 기여자 목록을 함께 보존합니다.

`desktop/src-tauri/icons/`는 앱에 필요한 아이콘 자산입니다. `target/`, `node_modules/`, `desktop/dashboard-dist/`, `desktop/releases/`, `.local/`은 소스 커밋 대상과 구분합니다. DMG·ZIP은 GitHub Releases의 바이너리 첨부물로 게시합니다. 앱 데이터·토큰·키 파일과 실계정 정보가 있는 스크린샷은 포함하지 않습니다. README는 실제 계정 화면 대신 앱 아이콘을 사용합니다.

이 저장소에는 원본 서비스의 CI·릴리스 워크플로, Python 패키지 설정과 기존 정책 문서도 남아 있습니다. 원본 서비스용 보안 정책의 연락처·지원 버전 표를 Codex Monitor의 지원 약속으로 옮겨 해석하지 않습니다. `CHANGELOG.md`도 상속된 원본 서비스의 릴리스 기록입니다. 앱의 변경 계약은 OpenSpec의 모니터링·데스크톱 항목을 참고합니다. 이들이 Codex Monitor의 DMG를 자동 배포한다고 설명하지 않습니다. 데스크톱 릴리스 자동화를 연결하기 전에는 각 워크플로의 트리거와 게시 대상을 확인하세요.

## 로컬 릴리스 생성

```sh
cd desktop
npm run package:macos
```

현재 버전 `0.1.9`의 Apple Silicon 결과 경로 예:

```text
desktop/releases/0.1.9/macos-arm64/
├── Codex-Monitor-0.1.9-macos-arm64.dmg
├── Codex-Monitor-0.1.9-macos-arm64.zip
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

## GitHub Releases 작성

소스와 문서를 올린 뒤 새 릴리스를 작성하고, 앱 버전에 맞는 태그·제목을 사용합니다. 예: `v0.1.9`, `Codex Monitor 0.1.9`.

첨부 대상은 DMG, ZIP, `SHA256SUMS.txt`, `release.json`입니다. 릴리스 본문에는 다음을 기록합니다.

- 검증한 아키텍처와 최소 macOS 설정.
- 계정별 잔여 한도·초기화권·이력·메뉴 막대 등 실제 포함 기능.
- 기존 앱 종료 후 Applications 폴더로 복사하는 설치 방법.
- 서명·공증의 실제 상태와 실행 검증 범위.
- 원본 codex-lb 및 [출처 문서](provenance.md) 링크.

현재 기록한 산출물은 Apple Silicon에서 검증한 로컬 빌드입니다. Intel·Windows·Linux 파일을 제공한다고 쓰지 않습니다. 서명·공증이나 이전 보안 검수 항목의 해결이 확인되기 전에는 완료했다고 표기하지 않습니다. GitHub Releases에 업로드하기 전에는 다운로드 가능한 공개 릴리스로 소개하지 않습니다.

[개발 안내](development.md) · [문서 목록](index.md)


## Windows 빌드와 소개 페이지

- [Windows 네이티브 빌드·설치 파일](windows.md): `Windows desktop` Actions 실행이 성공하면 `Codex-Monitor-windows-x64` artifact를 받습니다. 자동으로 공개 Release를 생성하지 않습니다.
- [GitHub Pages](website.md): `Project website and docs` 워크플로가 소개 페이지와 참조 문서를 하나의 Pages artifact로 배포합니다. 저장소 Settings → Pages → Source는 **GitHub Actions**로 선택합니다.
- 원본 Python 제품의 CI·릴리스·라벨 관리 워크플로는 `github.repository == 'Soju06/codex-lb'` 조건으로 원본 저장소에서만 실행되도록 보존합니다. 이 포크에서 실행할 워크플로는 데스크톱 Windows 빌드와 소개 페이지·문서 배포입니다.
- 업로드 전 검토한 소스와 아이콘만 커밋하고 `.local/`, `target/`, `desktop/releases/`, 앱 데이터 디렉터리는 포함하지 않습니다. GitHub 업로드와 실제 Pages 설정은 저장소 소유자가 진행합니다.

Mac 설치 실패 시 [서명·호환성 진단 안내](macos-installation.md)를 사용하세요. DMG에는 읽기 전용 진단 스크립트도 포함됩니다.
