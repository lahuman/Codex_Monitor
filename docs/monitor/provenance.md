# 모티브·코드 출처·크레딧

> 문서 계약: [monitor-documentation](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/specs/monitor-documentation/spec.md)

## 출발점: codex-lb

Codex Monitor는 [Soju06/codex-lb](https://github.com/Soju06/codex-lb) 저장소에서 출발한 파생 프로젝트입니다. 계정별 상태와 사용량을 한눈에 보여 주는 [원본 대시보드](https://soju06.github.io/codex-lb/)가 제품의 가장 직접적인 모티브입니다.

이 저장소는 원본 코드가 포함된 파생 프로젝트이며, 프런트엔드의 공통 컴포넌트·스타일 기반·번역·테마·개인정보 표시 훅 등을 활용합니다. 계정 서비스, OAuth 흐름, 사용량 조회 계약을 Rust로 구성하고 Tauri 창·메뉴 막대·모바일 대시보드·로컬 관측 이력과 연결했습니다. Android 홈 위젯과 WorkManager는 Kotlin으로 구현하고 같은 Rust 서비스의 토큰 없는 관측을 표시합니다.

`desktop/upstream.json`에 기록된 기준 커밋은 `f8ffbac2099a113fba54dfd8d77774f5bca80ffa`입니다. 이것은 출발점 추적 정보이며 원본의 최신 기능 전체를 이식하거나 검증했다는 의미는 아닙니다.

| 구분 | 이 프로젝트에서의 역할 |
| --- | --- |
| 원본 저장소·대시보드 | 소스 기반, 계정 모니터링 제품 아이디어, 공통 React UI 기반 |
| Rust·Tauri 추가 구현 | 데스크톱 계정 서비스, 공통 조회 소유자, IPC, 메뉴 막대, 로컬 이력, 초기화권 표시와 패키징 |
| 현재 제품 범위 | macOS·Windows·Android 계정 모니터링과 Android 홈 위젯 |
| 함께 남아 있는 코드 | 원본 Python 서비스와 프록시 관련 코드·문서; 기본 앱의 제공 기능과 구분 |

원본 README와 기여자 고지는 [README.upstream.md](https://github.com/lahuman/Codex_Monitor/blob/main/README.upstream.md)에 그대로 보존했습니다. 원본의 저작권·라이선스 고지는 [LICENSE](https://github.com/lahuman/Codex_Monitor/blob/main/LICENSE)에 있습니다.

## 시각적 참고: 에디토리얼 디자인

사용자가 제공한 Claude.com 계열의 에디토리얼 디자인 참고 자료에서 크림색 배경, 따뜻한 본문색, 코랄 강조색, 얇은 구분선과 제목 서체의 방향을 참고했습니다. 모니터링 앱에 맞춰 간격과 정보 밀도를 조정하고 밝은/어두운 테마를 구성했습니다.

Claude의 로고, 공식 브랜드 자산이나 라이선스가 필요한 상용 서체를 번들에 추가하지 않았습니다. 앱 아이콘은 `desktop/branding/icon.svg`의 별도 벡터 도안이며 잔여 한도 링·확인 표시·상태 점으로 구성했습니다. 제목에는 시스템 서체 대체 목록을 사용합니다. 원본 프런트엔드에서 이어받은 자체 호스팅 서체와 이 새 디자인 참고 자료는 출처를 구분합니다.

## 리팩토링 참고: Cursor pstack

[Cursor pstack](https://github.com/cursor/plugins/tree/main/pstack)의 불필요한 기능을 먼저 줄이기, 도메인 상태의 소유자 정하기, 호출부를 옮긴 뒤 기존 경로 정리하기 원칙을 참고했습니다.

이 방향으로 중복 조회 스케줄을 Rust 모니터 한곳으로 모으고 UI와 메뉴 막대가 같은 관측 상태를 읽도록 정리했습니다. 참고한 원칙과 적용 내용은 [리팩토링 기록](https://github.com/lahuman/Codex_Monitor/blob/main/openspec/changes/archive/2026-10-16-refactor-desktop-monitor/context.md)에 남아 있습니다. pstack 플러그인 설치나 모델 라우팅을 앱 기능으로 포함하지 않았습니다.

## 조사·프로토콜 참고

- [REA](https://github.com/morluto/rea)는 초기 조사 도구로 검토한 별도 역공학 프로젝트입니다. Codex Monitor의 코드 기반이나 실행·필수 빌드 의존성으로 포함하지 않았습니다.
- [OpenAI Codex 공개 소스](https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/suite/v2/rate_limits.rs)의 사용량·초기화권 계약을 참고했습니다. 이는 API 형식을 이해하기 위한 참고이며 OpenAI 공식 앱이라는 의미는 아닙니다.

## 라이선스와 독립성

이 저장소는 MIT 라이선스의 원본 코드에 기반하며 `Copyright (c) 2025 Soju06` 고지를 유지합니다. 추가 변경 내용은 이 저장소의 변경 이력과 OpenSpec 기록으로 추적합니다. 의존 라이브러리에는 각자의 라이선스가 적용됩니다.

OpenAI, Anthropic, Cursor 또는 원본 프로젝트의 공식 배포·보증·제휴를 나타내지 않습니다. 제품의 이름과 외형 변경으로 원본 기여를 대체하지 않습니다.

[기능 설명](features.md) · [문서 목록](index.md)


## 초기화권 만료 경고 참고 (0.1.2)

추가 확인 기준은 원본 커밋 `72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e`입니다. [남은 시간 포맷터](https://github.com/Soju06/codex-lb/blob/72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e/frontend/src/utils/formatters.ts)는 7일 미만을 만료 임박으로 판단하고, [초기화권 대화상자](https://github.com/Soju06/codex-lb/blob/72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e/frontend/src/features/accounts/components/reset-credit-confirm-dialog.tsx)는 수량·만료 날짜·카운트다운과 사용 확인 흐름을 제공합니다. [설정 화면](https://github.com/Soju06/codex-lb/blob/72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e/frontend/src/features/settings/components/reset-credit-settings.tsx)에는 수량·만료 배지와 자동 사용 옵션이 있습니다. [원본 계약](https://github.com/Soju06/codex-lb/blob/72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e/openspec/specs/rate-limit-reset-credits/spec.md)은 선택적 만료 5분 전 자동 사용을 정의합니다. 이는 고정 커밋의 소스 확인이며 원본 서버를 실행해 검증한 결과는 아닙니다.

Codex Monitor는 7일 미만 주의 기준을 참고하고, 24시간 이하 임박 강조와 계정별 대시보드 경고를 추가했습니다. Rust의 기존 조회 결과만 사용하며 원본의 사용·자동 사용 기능은 이식하지 않았습니다.
