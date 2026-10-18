#!/bin/bash
# Read-only: no app execution, quarantine removal, security changes or uploads.
export PATH=/usr/bin:/bin:/usr/sbin:/sbin
app="$1"
if [ -z "$app" ]; then
  echo 'Codex Monitor 설치 진단 (앱 데이터는 읽지 않습니다)'
  echo 'Finder에서 Codex Monitor.app을 이 터미널 창으로 드래그하고 Return을 누르세요.'
  IFS= read -r app
  # Finder drag/drop quotes/escapes spaces. Decode without eval or executing input.
  if [[ "$app" == \"*\" ]]; then app="${app:1:${#app}-2}"; fi
  if [[ "$app" == \'*\' ]]; then app="${app:1:${#app}-2}"; fi
  app="${app//\\ / }"
  app="${app% }"
fi
case "$app" in /*) ;; *) app="$PWD/$app" ;; esac
if [ ! -d "$app/Contents" ]; then
  echo '앱 경로를 확인하세요. 사용법: bash diagnose-macos.command "/Applications/Codex Monitor.app"'
  exit 2
fi
printf '\n=== Codex Monitor read-only installation report ===\n'
/usr/bin/sw_vers
printf 'Machine architecture: '; /usr/bin/uname -m
printf 'Translated process (1 = Rosetta): '; /usr/sbin/sysctl -n sysctl.proc_translated 2>/dev/null || echo 'not reported'
plist="$app/Contents/Info.plist"
for key in CFBundleName CFBundleShortVersionString CFBundleIdentifier LSMinimumSystemVersion; do
  printf '%s: ' "$key"
  /usr/libexec/PlistBuddy -c "Print :$key" "$plist" 2>&1
done
executable=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist" 2>/dev/null)
# Only inspect a bundle-local regular file; never execute the supplied name.
if [[ -n "$executable" && "$executable" != */* && ! -L "$app/Contents/MacOS/$executable" && -f "$app/Contents/MacOS/$executable" ]]; then
  /usr/bin/lipo -archs "$app/Contents/MacOS/$executable"
fi
if /usr/bin/xattr -p com.apple.quarantine "$app" >/dev/null 2>&1; then
  echo 'App quarantine attribute: present'
else
  echo 'App quarantine attribute: absent or unreadable'
fi
printf '\n--- Strict signature verification ---\n'
/usr/bin/codesign --verify --deep --strict --verbose=2 "$app" 2>&1
printf 'codesign exit: %s\n' "$?"
printf '\n--- Signing metadata ---\n'
/usr/bin/codesign -d --verbose=2 "$app" 2>&1
printf '\n--- Notarization ticket ---\n'
/usr/bin/xcrun stapler validate "$app" 2>&1
printf 'stapler exit: %s\n' "$?"
printf '\n--- Gatekeeper assessment ---\n'
/usr/sbin/spctl --assess --type execute --verbose=2 "$app" 2>&1
printf 'spctl exit: %s\n' "$?"
printf '\n=== End of report (no files changed or uploaded) ===\n'
if [ -t 0 ]; then
  printf '결과를 복사해 전달하세요. 창을 닫으려면 Return: '
  IFS= read -r _
fi
exit 0
