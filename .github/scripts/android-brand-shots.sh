#!/usr/bin/env bash
# Runs inside the emulator step (working dir: android/). Installs the agent test
# APK and the offline sandbox build, captures brand/theme screenshots, and
# writes them to $SHOTS. Never signs in or contacts the CRM: the launched app is
# the sandbox build (CRM_BASE_URL=https://invalid.invalid).
set -euo pipefail
SHOTS="${SHOTS:-/tmp/brand-shots}"
mkdir -p "$SHOTS"
adb wait-for-device
adb shell settings put global window_animation_scale 0 || true

DEBUG_APK=$(ls app/build/outputs/apk/debug/*.apk | head -1)
SANDBOX_APK=$(ls app/build/outputs/apk/sandbox/*.apk | head -1)
TEST_APK=$(ls app/build/outputs/apk/androidTest/sandbox/*.apk | head -1)
adb install -r -g "$DEBUG_APK"
adb install -r -g "$SANDBOX_APK"
adb install -r -g "$TEST_APK"

# 1) Brand-themed key screens rendered on the device.
adb shell am instrument -w -r \
  -e class com.winstone.connect.ui.BrandLookScreenshotTest \
  com.winstone.connect.sandbox.test/androidx.test.runner.AndroidJUnitRunner | tee "$SHOTS/instrument.txt"
grep -q "OK (" "$SHOTS/instrument.txt"
adb pull /sdcard/Android/data/com.winstone.connect.sandbox/files/brand-shots/. "$SHOTS/" || true

# 2) The real app's first screen, launched from its icon (offline sandbox copy).
adb shell monkey -p com.winstone.connect.sandbox -c android.intent.category.LAUNCHER 1
sleep 10
adb exec-out screencap -p > "$SHOTS/06-real-launch.png"

# 3) Home-screen icon: open the app drawer and search the app name.
adb shell input keyevent KEYCODE_HOME
sleep 3
adb shell input swipe 540 2000 540 500 400
sleep 4
adb exec-out screencap -p > "$SHOTS/07-app-drawer.png"
adb shell cmd package resolve-activity --brief com.winstone.connect.test | tee "$SHOTS/launcher.txt" || true
ls -la "$SHOTS"
