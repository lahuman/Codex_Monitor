# 0.1.21 전체 작업과 검증 정리

> 기능 계약: [monitor-documentation](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/monitor-documentation/spec.md), [desktop-release](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/desktop-release/spec.md), [android-monitor](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/android-monitor/spec.md)

Codex Monitor는 여러 계정의 한도·초기화권·관측 이력을 확인하는 Rust·Tauri 앱입니다. 이번 소스 정리는 데스크톱 가독성 개선부터 Android 독립 앱·백그라운드·홈 위젯까지 완료된 작업을 함께 반영합니다. 원본 서비스의 전체 기능 호환을 제품 목표로 삼지 않으며, 기본 앱은 요청 중계와 초기화권 자동 사용을 제공하지 않습니다.

## 기능별 완료 범위

| 영역 | 반영 내용 | 상세 |
| --- | --- | --- |
| 계정·인증 | 브라우저 로그인 주소/코드, 승인 후 앱 복귀 시 확인, 진행 상태 복원·일시 통신 오류 재시도 | [Android](android.md), [계정과 지표](features.md) |
| 데스크톱 | 계정별 한도·플랜·상태, 통일된 잔여율 색상, 1·3·6시간 감소와 24시간 차트, macOS 계정별 메뉴 빠른 보기·Windows 트레이 | [기능](features.md) |
| 초기화권 | 수량·만료일·가장 가까운 만료 요약, 전체 보기, 7일 미만 주의·24시간 이하 임박 강조 | [초기화권 설명](features.md) |
| 모바일 | 계정 카드 우선 대시보드, 상세 보기, 좁은 화면의 로그인·설정과 가독성 | [Android 대시보드](android.md) |
| 수집·배터리 | 끄기 또는 1·5·10·30·60·100분, 수동 수집, 공유 Rust 서비스·중복 요청 억제, WorkManager 최소 15분·배터리·네트워크 조건 | [Android 수집](android.md) |
| 홈 위젯 | 전체/계정별, 원형/막대, 테마·이름 숨김, 두꺼운 그래프와 오른쪽 %, 단일 갱신 시각, 기간별 초기화 날짜·시간, 글자 크기·너비·높이 대응 | [위젯 설정](android.md) |
| 배포 | macOS DMG·ZIP·설치 PKG와 오프라인 경고 안내, Windows NSIS, Android 검증 APK, 플랫폼별 SHA-256 | [게시 안내](publishing.md) |
| 출처 | codex-lb 소스·대시보드, 에디토리얼 디자인·pstack 참고 구분, MIT·원본 기여자 보존 | [출처와 크레딧](provenance.md) |

## 데이터의 의미

표시값은 제공자의 한도 관측이며 토큰 수·요금이 아닙니다. 최근 감소량은 비교 가능한 관측의 퍼센트포인트(%p)이고, 이력이 부족하거나 초기화를 가로지르면 집계하지 않습니다. 미확인과 0%를 구분하며, 위젯 갱신 시각은 그림을 그린 시간이 아닌 실제 저장 관측 시각입니다. 한도 초기화 시각과 초기화권 만료일도 구분합니다.

## 검증과 제한

- Rust 계정 서비스·인증 복원·반복 저장·모니터·이력과 전체 데스크톱/모바일 UI를 테스트합니다. 공유 라이브러리로 옮긴 테스트는 `cargo test --lib`로 실행합니다.
- Android 16 전용 에뮬레이터에서 위젯 계측 테스트 10개가 통과했습니다. 화면 밀도 160/420/480 dpi, 너비 180/280/360 dp, 글자 크기 100/130/150%, 전체·막대·원형의 81개 조합에서 날짜·시간의 가로/세로 잘림을 확인했습니다. 기본 280×180 두 계정과 200% 글씨의 공간 부족 안내도 확인했습니다.
- macOS·Windows는 GitHub Actions의 각 네이티브 실행 환경에서 테스트·패키징한 뒤 두 결과가 모두 성공해야 한 릴리즈로 공개합니다. 실제 설치·제거·업데이트·계정 로그인은 별도 기기 검증입니다.
- 실제 Samsung 기기·사용자 지정 글꼴·모든 런처와 절전 정책, Intel Mac·Windows ARM64는 검증 범위에 포함되지 않습니다. 백그라운드 예약은 Doze·제조사 정책으로 지연되며 강제 종료 중 수집을 약속하지 않습니다.
- Mac 앱은 자체 서명·Apple 미공증이고 Mac PKG·Windows 설치 파일은 미서명입니다. Android는 같은 미리보기 키의 APK 업데이트를 제공합니다. 정식 서명이나 보안 경고 해소를 주장하지 않습니다.

## 다운로드와 소스 추적

macOS·Windows는 [공통 Releases](https://github.com/lahuman/Codex_Monitor/releases)의 `desktop-v0.1.21`에서, Android는 [0.1.21 APK 미리보기](https://github.com/lahuman/Codex_Monitor/releases/tag/android-v0.1.21-preview)에서 확인합니다. 새 데스크톱 릴리즈는 테스트한 소스 커밋과 태그를 일치시키고, 업로드한 파일의 크기·해시도 확인한 뒤 공개합니다. 게시 성공 여부는 Releases와 연결된 Actions 실행을 기준으로 확인하세요.

과거 Android 미리보기 태그는 당시 기준 커밋을 가리킵니다. 그 태그의 자동 Source code ZIP을 당시 APK 전체 소스로 해석하지 않습니다. 이번 소스 반영으로 네이티브 Android 프로젝트·위젯·공유 Rust 구현·명세를 저장소에서 함께 확인할 수 있습니다. 개인 SDK 경로·계정 정보·서명 키·중간 빌드 산출물은 소스에서 제외합니다.

[문서 목록](index.md) · [개발과 테스트](development.md) · [프로젝트 소개 페이지](https://lahuman.github.io/Codex_Monitor/)
