# Codex Monitor 문서

> 문서 계약: [monitor-documentation](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/monitor-documentation/spec.md)

Codex Monitor는 Codex 계정의 한도·초기화권·관측 이력을 확인하는 macOS·Windows·Android용 설치형 모니터링 앱입니다. macOS Apple Silicon은 로컬 실행·패키징을 검증했으며, Windows x64와 Mac의 빌드·테스트·통합 Releases 등록 자동화를 제공합니다. 실제 Windows PC의 설치·로그인·트레이 검증은 별도로 확인합니다.

| 읽고 싶은 내용 | 문서 |
| --- | --- |
| 계정별 메뉴 막대, 잔여율 색상, 최근 1·3·6시간과 24시간 차트, 초기화권 경고 | [기능과 지표](features.md) |
| 0.1.21 전체 작업과 플랫폼별 검증 범위 | [작업·릴리즈 정리](releases.md) |
| 휴대폰 계정 연결, 조회 간격, 배터리·위젯 설정 | [Android 안내](android.md) |
| 실행, 빌드, 테스트, 코드 구조 | [개발 안내](development.md) |
| 원본 프로젝트, 디자인 모티브와 재사용 범위 | [출처와 크레딧](provenance.md) |
| GitHub 소개 문구, 릴리스 파일과 게시 절차 | [게시 안내](publishing.md) |

[프로젝트 README](https://github.com/lahuman/Codex_Monitor/blob/main/README.md)에서 설치 개요와 지원 상태를 확인할 수 있습니다.

이 경로의 문서는 Codex Monitor 앱을 설명합니다. 기존 `docs/`의 서버·Docker·프록시 안내는 상속된 codex-lb 서비스 자료입니다. 원본 안내는 [보존한 README](https://github.com/lahuman/Codex_Monitor/blob/main/README.upstream.md)와 [상위 프로젝트 문서](https://soju06.github.io/codex-lb/)를 참고하세요.

- [Windows 설치·빌드](windows.md)
- [프로젝트 웹페이지와 GitHub Pages](website.md)

- [Mac 설치·서명 문제 진단](macos-installation.md)

- [Android 앱·홈 화면 위젯·수집 설정](android.md)

## 화면 가독성

대시보드·계정 관리·메뉴 빠른 보기의 잔여율 색상과 글자 크기를 통일했습니다. 계정 관리에서는 기간별 잔여율을 간결한 막대로 비교하고, 로그인과 설정 창은 작은 화면에서도 버튼에 접근할 수 있습니다. 그래프의 눈금은 화면이 좁아져도 읽기 쉬운 크기를 유지합니다.

[화면 규격](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/monitoring-design/spec.md) · [데스크톱 미리보기](assets/readability-desktop.png) · [모바일 계정 관리](assets/readability-accounts.png) · [계정 연결](assets/readability-login.png)
