import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, copyFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const desktop = fileURLToPath(new URL("../", import.meta.url));
const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error("Set ANDROID_HOME to an installed Android SDK (Build Tools 36.0.0).");
function run(file, args) {
  const p = spawnSync(file, args, { cwd: desktop, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (p.error || p.status !== 0) throw new Error(`${path.basename(file)} failed: ${p.error?.message ?? p.stderr}`);
  return p.stdout;
}
let apk;
if (process.argv.length === 4 && process.argv[2] === "--existing-apk") apk = path.resolve(process.argv[3]);
else if (process.argv.length === 2) {
  const p = spawnSync(process.execPath, [path.join(desktop,"node_modules/@tauri-apps/cli/tauri.js"),"android","build","--debug","--features","android-worker","--apk","--target","aarch64","--config","src-tauri/tauri.android.conf.json"], { cwd: desktop, stdio: "inherit" });
  if (p.error || p.status !== 0) throw new Error("Android build failed.");
  apk = path.join(desktop,"src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk");
} else throw new Error("Usage: npm run package:android [-- --existing-apk PATH]");
const config = JSON.parse(await readFile(path.join(desktop,"src-tauri/tauri.conf.json"),"utf8"));
const tools = path.join(sdk,"build-tools/36.0.0");
const signing = run(path.join(tools, process.platform === "win32" ? "apksigner.bat" : "apksigner"), ["verify","--verbose","--print-certs",apk]);
const manifest = run(path.join(tools, process.platform === "win32" ? "aapt.exe" : "aapt"), ["dump","badging",apk]);
const packageLine = manifest.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m);
if (!packageLine || packageLine[1] !== config.identifier.replaceAll("-","_") || packageLine[3] !== config.version || !/^native-code: 'arm64-v8a'\s*$/m.test(manifest) || !manifest.includes("launchable-activity:")) throw new Error("APK identity/version/architecture/launcher mismatch.");
const xml = run(path.join(tools, process.platform === "win32" ? "aapt.exe" : "aapt"), ["dump","xmltree",apk,"AndroidManifest.xml"]);
if (!xml.includes(`${packageLine[1]}.MonitorWidget`) || !/android:allowBackup[^\n]*0x0\s*$/m.test(xml) || !/android:usesCleartextTraffic[^\n]*0x0\s*$/m.test(xml) || !/android:debuggable[^\n]*0xffffffff\s*$/m.test(xml)) throw new Error("APK widget/backup/transport/preview configuration mismatch.");
const digest = signing.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1];
if (!digest) throw new Error("APK signer digest not available.");
const output = path.join(desktop,"releases",config.version,"android-arm64");
try { await access(output); throw new Error("Release directory exists; preserve it or bump the version."); } catch (e) { if (e.code !== "ENOENT") throw e; }
const file = `Codex-Monitor-${config.version}-android-arm64-preview.apk`;
const bytes = await readFile(apk);
const sha256 = createHash("sha256").update(bytes).digest("hex");
await mkdir(output,{recursive:true});
await copyFile(apk,path.join(output,file));
await writeFile(path.join(output,"SHA256SUMS.txt"),`${sha256}  ${file}\n`);
await writeFile(path.join(output,"release.json"), JSON.stringify({productName:config.productName, version:config.version, package:packageLine[1], versionCode:Number(packageLine[2]), architecture:"arm64-v8a", minimumAndroid:"8.0 (API 26)", signing:{kind:"android-debug-preview", verified:true, certificateSha256:digest}, artifacts:[{file,sha256,bytes:bytes.length}]},null,2)+"\n");
await writeFile(path.join(output,"설치 안내.txt"),`Codex Monitor ${config.version} Android 미리보기\nAndroid 8.0 이상 · ARM64\n\nAPK를 휴대폰에 복사하여 열고 파일을 연 앱의 ‘알 수 없는 앱 설치’ 허용을 확인하세요. 정식 Play Store 배포본이 아닌 디버그 서명 미리보기입니다. 정식 서명 전환 시 앱을 삭제해야 할 수 있으며 계정/이력이 삭제될 수 있으므로 업데이트 서명 키를 별도 관리해야 합니다.\n\n앱에서 계정 연결 → 표시된 주소와 코드로 Chrome 등 외부 브라우저에서 로그인합니다. 브라우저에서 로그인됨을 확인하면 Codex Monitor 앱으로 돌아오세요. 지연되면 로그인 창의 ‘연결 상태 다시 확인’을 누릅니다. 0.1.13에서 이미 잃어버린 연결은 업데이트 후 새 코드를 발급받아 진행하세요.\n자동 조회: 안 함 / 1 / 5 / 10 / 30 / 60 / 100분. 기본 10분이며 설정이 유지됩니다.\n지금 수집하기: 자동 조회가 꺼져 있어도 활성 계정을 수동 수집합니다.\n홈 화면 위젯 추가: 앱의 버튼 또는 홈 화면을 길게 눌러 위젯 목록에서 Codex Monitor 선택.\n위젯은 마지막 저장 관측값만 보여주며 탭하면 앱을 엽니다. 백그라운드는 최소 15분 간격으로 네트워크 연결·배터리 여유 시 예약 수집하며 절전 정책에 따라 지연됩니다. 설정에서 강제 종료하면 다시 앱을 열어야 합니다. PC 동기화는 하지 않습니다.\n\nhttps://lahuman.github.io/Codex_Monitor/\n`);
console.log(`Verified Android preview: ${output}`);
