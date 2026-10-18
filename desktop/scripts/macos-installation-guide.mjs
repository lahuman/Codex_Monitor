import {
  projectWebsite,
  projectReleases,
  projectMacGuide,
} from "./project-links.mjs";
export const installationGuideFile = "먼저 읽어주세요.html";
export const installerGuideResource = "installation-guide.html";
const appleHelp = "https://support.apple.com/ko-kr/102445";
const escapeHTML = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// One producer owns the DMG, plain-text and native Installer guidance.
export function macInstallationGuide(config, signing) {
  const title = `${config.productName} ${config.version} — 설치와 첫 실행 안내`;
  const status = `앱 서명: ${signing.kind} · Apple 공증 티켓: ${signing.notarizationTicket.status} · Gatekeeper: ${signing.gatekeeper.status} · 설치 파일(PKG): 미서명 / unsigned`;
  const introduction =
    "현재 배포본은 macOS의 개발자 확인 경고가 표시될 수 있습니다. Apple이 악성코드가 없는지 확인할 수 없다는 경고는 악성코드 탐지 확정과 다릅니다. 파일 서명·체크섬이 정상이어도 악성코드가 없음을 보장하지는 않습니다.";
  const sections = [
    {
      title: "1. 설치하기",
      steps: [
        "공식 배포처에서 받은 원본인지 확인하세요. 출처나 무결성이 불확실하면 설치하지 마세요.",
        "기존 Codex Monitor를 종료한 뒤 ‘설치하기.pkg’를 열면 진행률과 완료 화면을 볼 수 있습니다. 앱을 Applications로 드래그해 설치할 수도 있습니다.",
        "설치 후 응용 프로그램 폴더의 Codex Monitor를 실행합니다. 앱 교체는 기존 계정·모니터링 데이터를 지우지 않습니다.",
      ],
    },
    {
      title: "2. ‘Apple이 악성코드가 없는지 확인할 수 없음’ 경고가 뜬다면",
      steps: [
        "신뢰하는 배포 원본이며 변조되지 않았음을 확인한 경우에만 다음 절차를 진행하세요.",
        "앱이나 설치 파일을 한 번 열어 경고가 표시되면 ‘완료(Done)’를 누릅니다.",
        "시스템 설정 → 개인정보 보호 및 보안 → 보안에서 해당 앱의 ‘그래도 열기(Open Anyway)’를 누릅니다.",
        "인증과 확인창을 거쳐 ‘열기’를 선택합니다. 설치 파일과 설치된 앱은 각각 처음 열 때 확인이 필요할 수 있습니다.",
        "‘그래도 열기’가 없거나 회사에서 관리하는 Mac이면 아래 Apple 안내 또는 관리자에게 문의하세요.",
      ],
    },
    {
      title: "3. 이런 경우에는 진행을 중단하세요",
      steps: [
        "악성코드가 탐지되었거나 컴퓨터를 손상시킨다는 경고, 앱 손상·인증 취소, 서명·체크섬 불일치는 위 확인 불가 경고와 다릅니다. 실행을 허용하지 말고 배포자에게 문의하세요.",
        "확인이 필요하면 DMG의 Diagnose-Codex-Monitor.command를 터미널에서 실행해 보고서를 전달할 수 있습니다. 이 진단은 앱을 실행하거나 계정·보안 설정을 변경하지 않습니다.",
      ],
    },
    {
      title: "English — installation and first launch",
      steps: [
        "This package is unsigned. See the app signing, notarization-ticket and Gatekeeper results above; valid file signatures do not prove absence of malware.",
        "Quit the old app. Open 설치하기.pkg for native installation progress, or drag the app into Applications, then launch it from Applications.",
        "Only for a trusted, unmodified release: attempt to open it, choose Done, then System Settings → Privacy & Security → Open Anyway, authenticate and confirm Open. The installer and installed app may need separate confirmation.",
        "Stop for detected-malware, revoked, damaged-app or failed-integrity warnings. Contact the distributor. This guide does not disable protections or remove quarantine.",
      ],
    },
  ];
  const text =
    [
      title,
      status,
      introduction,
      ...sections.flatMap((s) => [
        s.title,
        ...s.steps.map((step, index) => `${index + 1}. ${step}`),
      ]),
      `프로젝트 / Project: ${projectWebsite}`,
      `배포 파일 / Releases: ${projectReleases}`,
      `Mac 설치 안내 / Mac guide: ${projectMacGuide}`,
      `Apple 공식 안내 / Official Apple guidance: ${appleHelp}`,
    ].join("\n\n") + "\n";
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title>
<style>body{font:14px/1.7 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;color:#2f332e;background:#f7f5ef;max-width:760px;margin:24px auto;padding:0 22px 28px}h1{font-size:25px;line-height:1.35;font-weight:600;letter-spacing:-.7px;margin:8px 0 16px}h2{font-size:16px;margin:0 0 10px;font-weight:600}p{margin:12px 0}.brand{font-size:10px;font-weight:600;letter-spacing:2px;color:#a9513c}.notice{border-left:3px solid #a9513c;padding:12px 16px;background:#f2e9dd;color:#654536}.status{font-size:11px;color:#62695f;overflow-wrap:anywhere}section{border:1px solid #dcded4;border-radius:8px;background:#fffef9;margin:16px 0;padding:18px}li{margin:8px 0}ol{padding-left:21px;margin:0}a{color:#93452f;overflow-wrap:anywhere;text-underline-offset:3px}.resources{padding:14px 0;border-top:1px solid #dcded4;font-size:12px}.resources a{display:inline-block;margin:0 18px 6px 0}@media(max-width:480px){body{margin:16px auto;padding-inline:14px}h1{font-size:21px}section{padding:14px}}@media print{body{background:white}section{break-inside:avoid}}</style></head><body>
<p class="brand">CODEX MONITOR · INSTALLATION</p><h1>${escapeHTML(title)}</h1><p class="status">${escapeHTML(status)}</p><p class="notice">${escapeHTML(introduction)}</p>
${sections.map((s) => `<section><h2>${escapeHTML(s.title)}</h2><ol>${s.steps.map((step) => `<li>${escapeHTML(step)}</li>`).join("")}</ol></section>`).join("\n")}
<div class="resources"><a href="${projectWebsite}">프로젝트 / Project</a><a href="${projectReleases}">배포 파일 / Releases</a><a href="${projectMacGuide}">Mac 설치 안내 / Mac guide</a></div>
<p><a href="${appleHelp}">Apple 공식 안내 / Official Apple guidance</a></p></body></html>\n`;
  return { html, text };
}
