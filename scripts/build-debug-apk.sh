#!/usr/bin/env bash
# Builds the Winstone Connect TEST APK (com.winstone.connect.test, 2.18-test) locally
# and prints its SHA-256. Needs JDK 17 and an Android SDK (Android Studio provides both).
# Never touches signing keys; the debug build uses the standard local debug key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"

if [ ! -f local.properties ] && [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
  echo "Android SDK not found. Set ANDROID_HOME or copy local.properties.example to local.properties." >&2
  exit 1
fi

chmod +x ./gradlew
./gradlew --no-daemon :app:assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "Build finished but $APK was not found." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  SUM="$(sha256sum "$APK" | awk '{print $1}')"
else
  SUM="$(shasum -a 256 "$APK" | awk '{print $1}')"
fi

echo ""
echo "APK:     $ROOT/android/$APK"
echo "Size:    $(wc -c < "$APK" | tr -d ' ') bytes"
echo "SHA-256: $SUM"
