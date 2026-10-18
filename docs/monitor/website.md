# 프로젝트 웹페이지와 GitHub Pages

> 기능 계약: [project-site](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/project-site/spec.md)

소개 페이지는 `website/`에 있는 정적 HTML·CSS·JavaScript로 구성됩니다. 크림색·코랄 포인트와 앱 아이콘을 공유하고, 기능 소개, 기간 전환이 가능한 예시 대시보드, OS별 Releases 다운로드·설치 안내와 출처를 제공합니다. 계정별 두 줄 메뉴 막대, 잔여율 색상, 최근 1·3·6시간 감소량과 24시간 차트, 초기화권의 간소화된 표시와 만료 경고를 소개합니다. 빠른 보기 이미지는 가상 계정의 검증 화면입니다. 로그인·실제 계정 조회·분석 추적 스크립트는 없으며 예시 수치는 실제 사용자의 데이터가 아닙니다.

## 로컬 미리보기

저장소 루트에서 실행합니다. 버전은 Tauri 설정에서 읽고, 아이콘은 데스크톱 원본 벡터 파일에서 복사합니다.

```sh
node scripts/desktop/build-website.mjs
python3 -m http.server 8080 --directory site
```

`http://localhost:8080`에서 소개 페이지를 볼 수 있습니다. 문서 링크까지 확인하려면 먼저 아래 통합 빌드를 사용합니다.

```sh
uv sync --only-group docs --frozen
uv run --no-sync mkdocs build --strict --site-dir site/docs
node scripts/desktop/build-website.mjs
```

페이지의 자산은 상대 경로로 연결되어 저장소 프로젝트 경로 `/Codex_Monitor/`에서도 동작합니다. 생성한 `site/`는 커밋하지 않습니다.

## GitHub 설정과 배포

1. 수정한 소스를 **lahuman/Codex_Monitor** 저장소의 `main`에 반영합니다. 저장소 소유자가 업로드합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다.
3. 저장소 Actions를 활성화하고 **Project website and docs** 워크플로를 확인합니다. `main`의 관련 파일 push 또는 **Run workflow**로 실행합니다.
4. build와 deploy 작업이 모두 성공하면 배포 URL을 엽니다.

공식 주소:

- 소개: `https://lahuman.github.io/Codex_Monitor/`
- 현재 앱 문서: `https://lahuman.github.io/Codex_Monitor/docs/monitor/`
- 원본 서비스 참조를 포함한 전체 문서: `https://lahuman.github.io/Codex_Monitor/docs/`

`.github/workflows/docs.yml` 하나가 `site/docs/`에 MkDocs를 빌드하고, `site/`에 소개 페이지를 추가한 뒤 전체를 하나의 Pages artifact로 올립니다. 소개와 문서를 다른 워크플로로 따로 배포하면 서로 덮어쓸 수 있으므로 배포 소유자를 하나로 유지합니다. PR에서는 빌드만 확인하며 `main`에서만 배포합니다. 배포 작업에는 `pages: write`와 `id-token: write` 권한을 부여합니다.

## 수정할 위치

| 변경 | 소스 |
| --- | --- |
| 카피·섹션·다운로드 링크 | `website/index.html` |
| 색상·반응형 레이아웃 | `website/assets/style.css` |
| 예시 기간 전환 | `website/assets/site.js` |
| 버전·정규 아이콘 | `desktop/src-tauri/tauri.conf.json`, `desktop/branding/icon.svg` |
| 생성·배포 | `scripts/desktop/build-website.mjs`, `.github/workflows/docs.yml` |

두 플랫폼의 다운로드는 공통 Releases 목록으로 연결합니다. 통합 빌드·공개 성공 전에는 특정 파일이 이미 게시되었다고 표시하지 않습니다. macOS 자체 서명·미공증 및 Windows 미서명 상태와 실제 PC 검증 범위를 구분합니다. [Mac 설치 가이드](macos-installation.md), [Windows 안내](windows.md), [정식 릴리스 전환](publishing.md#stable-release)을 함께 제공합니다.

문서를 포함한 페이지 변경사항을 `main`에 푸시하면 기존 Pages 워크플로가 다시 배포합니다. 로컬 빌드 완료와 실제 공개 페이지 갱신은 별개입니다.

참고: [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 404 또는 README 페이지가 보이는 경우

주소는 대소문자를 구분합니다. 정확한 주소는 [https://lahuman.github.io/Codex_Monitor/](https://lahuman.github.io/Codex_Monitor/)이며 첫 글자 C가 대문자입니다. Settings → Pages → Source는 **GitHub Actions**로 선택합니다. **Deploy from a branch**를 사용하면 기본 Jekyll 배포가 소개 페이지를 덮어쓸 수 있습니다. 변경 후 **Project website and docs → Run workflow → main**을 실행합니다. 이 워크플로는 Pages source가 branch 방식이면 설정 변경 안내와 함께 배포 전에 실패합니다.

프로젝트 생성물의 주소는 `desktop/scripts/project-links.mjs`에서 관리합니다. Windows 설치 파일의 홈페이지 메타데이터와 MkDocs의 `site_url`도 이 주소와 일치해야 합니다. 과거 릴리스 파일은 교체하지 않으며, 디자인·주소가 반영된 설치 파일은 0.1.11부터 새로 생성합니다.
