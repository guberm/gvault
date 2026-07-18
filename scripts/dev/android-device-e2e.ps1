param(
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"

function Invoke-AdbInstall {
  param(
    [string]$DeviceSerial,
    [string]$ApkPath
  )

  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    return & adb -s $DeviceSerial install -r $ApkPath 2>&1
  } finally {
    $ErrorActionPreference = $oldPreference
  }
}

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$apk = "apps/mobile/dist/gvault-android-v$version.apk"
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK not found: $apk. Run npm run build:android first."
}

if (-not $Serial) {
  $devices = adb devices -l | Select-String " device " | ForEach-Object { ($_ -split "\s+")[0] }
  $Serial = $devices | Select-Object -First 1
}
if (-not $Serial) {
  throw "No authorized Android device found."
}

$installOutput = Invoke-AdbInstall $Serial $apk
if (($installOutput -join "`n") -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE") {
  adb -s $Serial uninstall com.gvault.app | Out-Null
  $installOutput = Invoke-AdbInstall $Serial $apk
}
if (($installOutput -join "`n") -notmatch "Success") {
  throw "APK install failed: $installOutput"
}

adb -s $Serial shell am force-stop com.gvault.app | Out-Null
adb -s $Serial shell am start -n com.gvault.app/.MainActivity | Out-Null
Start-Sleep -Seconds 2

$package = adb -s $Serial shell dumpsys package com.gvault.app
if (($package -join "`n") -notmatch "versionName=$version") {
  throw "Installed version mismatch."
}
if (($package -join "`n") -notmatch "GVaultAutofillService") {
  throw "Android AutofillService not registered."
}

adb -s $Serial shell uiautomator dump /sdcard/gvault-window.xml | Out-Null
$ui = adb -s $Serial shell cat /sdcard/gvault-window.xml
$uiText = $ui -join "`n"
if ($uiText -notmatch "GVault") {
  throw "GVault text not found in device UI."
}
if ($uiText -notmatch "Sign in or create an account to use your server-backed encrypted vault") {
  throw "Android auth-first subtitle not found in device UI."
}
if ($uiText -notmatch "https://gvault.guber.dev") {
  throw "Android public server default not found in device UI."
}
if ($uiText -notmatch "Regular sign in uses only email and account password") {
  throw "Android regular-login guidance not found in device UI."
}
if ($uiText -match "Master password" -or $uiText -match "Confirm master password") {
  throw "Android regular-login screen must not show master-password fields."
}
if ($uiText -notmatch "Sign in" -or $uiText -notmatch "Create account") {
  throw "Android auth actions not found in device UI."
}

"GVault Android device e2e ok on $Serial"
