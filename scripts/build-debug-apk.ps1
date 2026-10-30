# Windows version: builds the Winstone Connect TEST APK and prints its SHA-256.
# Needs JDK 17 and an Android SDK (Android Studio provides both).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "android")

& .\gradlew.bat --no-daemon :app:assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed."; exit 1 }

$apk = "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { Write-Error "Build finished but $apk was not found."; exit 1 }

$hash = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
Write-Host ""
Write-Host "APK:     $(Resolve-Path $apk)"
Write-Host "Size:    $((Get-Item $apk).Length) bytes"
Write-Host "SHA-256: $hash"
