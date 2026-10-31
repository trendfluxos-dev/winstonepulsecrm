#!/usr/bin/env bash
# Release gate for Winstone Connect APKs. CI runs this after building and
# BEFORE any step that makes an APK available to agents (apk-builds branch,
# Actions artifact, GitHub Release). Any failed check exits non-zero, so the
# publishing steps after it never run.
#
# Checks:
#   1. Version: build.gradle.kts declares the expected versionName/versionCode,
#      and the built APK's manifest carries exactly those (plus -test suffix).
#   2. Package id: com.winstone.connect (release) / com.winstone.connect.test (test).
#   3. Signing identity: apksigner verifies with v2/v3, exactly one signer, and
#      its certificate SHA-256 equals the expected fingerprint. Release refuses
#      the Android debug certificate and refuses to run without a fingerprint.
#      Test builds compare against the expected fingerprint or, when none is
#      given, the previous test build record (so agents can update in place).
#   4. Checksum: writes <apk>.sha256 and re-verifies it with sha256sum -c.
# Only public certificate fingerprints are read; no keystore or password is touched.
#
# Usage:
#   verify-android-apk.sh --apk FILE --flavor release|test --gradle FILE \
#     --version-name 2.22 --version-code 33 [--expected-cert HEX] \
#     [--previous-info FILE] [--report FILE]
# Tools: aapt2 and apksigner from $BUILD_TOOLS_DIR, else the newest
# $ANDROID_HOME/build-tools/<version>.
set -euo pipefail

fail() { echo "::error::APK release check failed: $*" >&2; exit 1; }

APK="" FLAVOR="" GRADLE="" VNAME="" VCODE="" WANT_CERT="" PREV_INFO="" REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apk) APK="$2"; shift 2 ;;
    --flavor) FLAVOR="$2"; shift 2 ;;
    --gradle) GRADLE="$2"; shift 2 ;;
    --version-name) VNAME="$2"; shift 2 ;;
    --version-code) VCODE="$2"; shift 2 ;;
    --expected-cert) WANT_CERT="$2"; shift 2 ;;
    --previous-info) PREV_INFO="$2"; shift 2 ;;
    --report) REPORT="$2"; shift 2 ;;
    *) fail "unknown argument $1" ;;
  esac
done

[ -n "$APK" ] && [ -f "$APK" ] || fail "APK file not found: ${APK:-<none>}"
[ -n "$GRADLE" ] && [ -f "$GRADLE" ] || fail "build.gradle.kts not found: ${GRADLE:-<none>}"
[[ "$VNAME" =~ ^[0-9]+(\.[0-9]+)*$ ]] || fail "expected version name must look like 2.22, got '${VNAME}'"
[[ "$VCODE" =~ ^[0-9]+$ ]] || fail "expected version code must be a number, got '${VCODE}'"
case "$FLAVOR" in
  release) PKG="com.winstone.connect"; APK_VNAME="$VNAME" ;;
  test) PKG="com.winstone.connect.test"; APK_VNAME="$VNAME-test" ;;
  *) fail "flavor must be release or test, got '${FLAVOR}'" ;;
esac

normalize_cert() { echo "$1" | tr -d ': \t\r\n' | tr 'A-F' 'a-f'; }

if [ -n "${BUILD_TOOLS_DIR:-}" ]; then
  BT="$BUILD_TOOLS_DIR"
else
  [ -n "${ANDROID_HOME:-}" ] || fail "ANDROID_HOME is not set"
  BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
fi
[ -x "$BT/aapt2" ] || fail "aapt2 not found in $BT"
[ -x "$BT/apksigner" ] || fail "apksigner not found in $BT"

# 1. Declared version in source.
grep -Eq "^[[:space:]]*versionName = \"${VNAME//./\\.}\"[[:space:]]*$" "$GRADLE" \
  || fail "build.gradle.kts does not declare versionName \"$VNAME\""
grep -Eq "^[[:space:]]*versionCode = ${VCODE}[[:space:]]*$" "$GRADLE" \
  || fail "build.gradle.kts does not declare versionCode $VCODE"

# 1-2. Built APK manifest.
BADGING=$("$BT/aapt2" dump badging "$APK" | head -1) || fail "aapt2 could not read the APK"
echo "$BADGING"
# Anchor each field: aapt2 also prints platformBuildVersionName/Code and
# compileSdkVersionCodename, which a greedy ".*name=" would match instead.
ACT_PKG=$(echo "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")
ACT_VCODE=$(echo "$BADGING" | sed -n "s/.* versionCode='\([^']*\)'.*/\1/p")
ACT_VNAME=$(echo "$BADGING" | sed -n "s/.* versionName='\([^']*\)'.*/\1/p")
[ "$ACT_PKG" = "$PKG" ] || fail "package is '$ACT_PKG', expected '$PKG'"
[ "$ACT_VCODE" = "$VCODE" ] || fail "APK versionCode is '$ACT_VCODE', expected '$VCODE'"
[ "$ACT_VNAME" = "$APK_VNAME" ] || fail "APK versionName is '$ACT_VNAME', expected '$APK_VNAME'"

# 3. Signing identity.
CERTS=$("$BT/apksigner" verify --verbose --print-certs "$APK" 2>&1) || fail "apksigner did not verify the APK signature"
echo "$CERTS" | grep -q "^Verifies" || fail "apksigner did not report 'Verifies'"
echo "$CERTS" | grep -Eq "^Verified using v(2|3) scheme.*: true" \
  || fail "APK is not signed with APK Signature Scheme v2 or v3"
# apksigner labels signers "Signer #1" or, for SDK-targeted v3/v3.1 blocks,
# "Signer (minSdkVersion=24, maxSdkVersion=2147483647)". The same certificate can
# appear once per block, so count DISTINCT certificate digests. Certificates and
# fingerprints are public; key material never reaches this output.
SIGNER_RE='^[[:space:]]*Signer (#[0-9]+|\(minSdkVersion=[0-9]+, maxSdkVersion=[0-9]+\)) certificate'
echo "$CERTS" | grep -E "^Verif|^Number of signers|$SIGNER_RE (DN|SHA-256 digest)" || true
DIGESTS=$(echo "$CERTS" | grep -E "$SIGNER_RE SHA-256 digest: " | awk -F': ' '{print $NF}' | tr -d ': ' | tr 'A-F' 'a-f' | sort -u)
SIGNERS=$(printf '%s' "$DIGESTS" | grep -c . || true)
[ "$SIGNERS" = "1" ] || fail "expected exactly one signer certificate, found $SIGNERS"
ACT_CERT=$(normalize_cert "$DIGESTS")
[[ "$ACT_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "could not read the signer SHA-256 fingerprint"
SIGNER_DN=$(echo "$CERTS" | grep -E -m1 "$SIGNER_RE DN: " | sed -E 's/^.* certificate DN: //')

WANT=$(normalize_cert "$WANT_CERT")
CERT_SOURCE="expected fingerprint"
if [ -z "$WANT" ] && [ "$FLAVOR" = "test" ] && [ -n "$PREV_INFO" ] && [ -f "$PREV_INFO" ]; then
  WANT=$(normalize_cert "$(sed -n 's/^signer_sha256: //p' "$PREV_INFO" | head -1)")
  CERT_SOURCE="previous test build record"
fi
if [ "$FLAVOR" = "release" ]; then
  case "$SIGNER_DN" in *"CN=Android Debug"*) fail "release APK is signed with the Android debug key" ;; esac
  [ -n "$WANT" ] || fail "no expected release fingerprint; set repository variable WINSTONE_RELEASE_CERT_SHA256 (actual: $ACT_CERT)"
fi
if [ -n "$WANT" ]; then
  [[ "$WANT" =~ ^[0-9a-f]{64}$ ]] || fail "expected fingerprint from $CERT_SOURCE is not a SHA-256 digest"
  [ "$ACT_CERT" = "$WANT" ] || fail "signer fingerprint $ACT_CERT does not match $CERT_SOURCE $WANT; agents could not update in place"
  CERT_STATUS="matches $CERT_SOURCE"
else
  CERT_STATUS="first recorded test fingerprint (no earlier record)"
  echo "::notice::No earlier test signer record; recording $ACT_CERT as the test fingerprint."
fi

# 4. Checksum.
APK_DIR=$(cd "$(dirname "$APK")" && pwd)
APK_BASE=$(basename "$APK")
SHA=$(cd "$APK_DIR" && sha256sum "$APK_BASE" | awk '{print $1}')
(cd "$APK_DIR" && echo "$SHA  $APK_BASE" > "$APK_BASE.sha256" && sha256sum -c --status "$APK_BASE.sha256") \
  || fail "checksum file did not verify"

SUMMARY="package: $PKG
version: $APK_VNAME (versionCode $VCODE)
signer_sha256: $ACT_CERT
signer_check: $CERT_STATUS
sha256: $SHA"
echo "APK release check passed"
echo "$SUMMARY"
[ -z "$REPORT" ] || echo "$SUMMARY" > "$REPORT"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  { echo "sha256=$SHA"; echo "signer_sha256=$ACT_CERT"; echo "apk=$APK_DIR/$APK_BASE"; } >> "$GITHUB_OUTPUT"
fi
