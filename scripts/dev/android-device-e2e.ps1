param(
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$apk = "apps/mobile/dist/gvault-android-v$version.apk"
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK not found: $apk. Run npm run build:android first."
}

if (-not $Serial) {
  $devices = adb devices -l | Select-String " device " | ForEach-Object { ($_ -split "\s+")[0] }
  $Serial = $devices | Select-Object -First 1
}
if (-not $Serial) { throw "No authorized Android device found." }

adb -s $Serial install -r $apk | Tee-Object -Variable installOutput | Out-Null
if (($installOutput -join "`n") -notmatch "Success") { throw "APK install failed: $installOutput" }

adb -s $Serial shell am force-stop com.gvault.app | Out-Null
adb -s $Serial shell am start -n com.gvault.app/.MainActivity | Out-Null
Start-Sleep -Seconds 2

$package = adb -s $Serial shell dumpsys package com.gvault.app
if (($package -join "`n") -notmatch "versionName=$version") { throw "Installed version mismatch." }

adb -s $Serial shell uiautomator dump /sdcard/gvault-window.xml | Out-Null
$ui = adb -s $Serial shell cat /sdcard/gvault-window.xml
if (($ui -join "`n") -notmatch "GVault") { throw "GVault text not found in device UI." }

Write-Output "android device e2e ok: $Serial, GVault $version"
