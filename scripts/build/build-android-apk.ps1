param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [string]$File,
    [string[]]$Arguments
  )

  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File failed with exit code $LASTEXITCODE"
  }
}

function Find-Tool {
  param(
    [string]$Name,
    [string]$Fallback
  )

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if ($Fallback -and (Test-Path -LiteralPath $Fallback)) { return $Fallback }
  throw "$Name not found."
}

function Version-Code {
  param([string]$Version)
  $parts = $Version.Split(".") | ForEach-Object { [int]$_ }
  while ($parts.Count -lt 3) { $parts += 0 }
  return ($parts[0] * 10000) + ($parts[1] * 100) + $parts[2]
}

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path -LiteralPath $sdk)) {
  throw "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
}

$platform = Get-ChildItem (Join-Path $sdk "platforms") -Directory | Sort-Object Name -Descending | Select-Object -First 1
$buildTools = Get-ChildItem (Join-Path $sdk "build-tools") -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $platform -or -not $buildTools) {
  throw "Android platform/build-tools not found in $sdk."
}

$aapt2 = Join-Path $buildTools.FullName "aapt2.exe"
$d8 = Join-Path $buildTools.FullName "d8.bat"
$zipalign = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"
$androidJar = Join-Path $platform.FullName "android.jar"
$keytool = Find-Tool "keytool" "C:\Program Files\Java\jdk-22\bin\keytool.exe"
$jar = Find-Tool "jar" "C:\Program Files\Java\jdk-22\bin\jar.exe"

$root = (Resolve-Path ".").Path
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$versionCode = Version-Code $version
$app = Join-Path $root "apps\mobile\android"
$build = Join-Path $root "apps\mobile\build\android"
$out = Join-Path $root "apps\mobile\dist"
$classes = Join-Path $build "classes"
$resZip = Join-Path $build "res.zip"
$unsigned = Join-Path $build "gvault-unsigned.apk"
$unaligned = Join-Path $build "gvault-unaligned.apk"
$apk = Join-Path $out "gvault-android-v$version.apk"

$defaultKeystore = Join-Path $app "gvault-debug.keystore"
$keystore = if ($env:GV_ANDROID_KEYSTORE) { $env:GV_ANDROID_KEYSTORE } else { $defaultKeystore }
$storePass = if ($env:GV_ANDROID_KEYSTORE_PASSWORD) { $env:GV_ANDROID_KEYSTORE_PASSWORD } else { "android" }
$keyPass = if ($env:GV_ANDROID_KEY_PASSWORD) { $env:GV_ANDROID_KEY_PASSWORD } else { $storePass }
$keyAlias = if ($env:GV_ANDROID_KEY_ALIAS) { $env:GV_ANDROID_KEY_ALIAS } else { "gvault-debug" }

if (-not (Test-Path -LiteralPath $keystore)) {
  if ($keystore -ne $defaultKeystore) {
    throw "Configured Android keystore not found: $keystore"
  }
  Invoke-Checked $keytool @(
    "-genkeypair", "-v",
    "-keystore", $keystore,
    "-storepass", $storePass,
    "-keypass", $keyPass,
    "-alias", $keyAlias,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-dname", "CN=GVault Debug,O=GVault,C=US"
  )
}

Remove-Item -LiteralPath $build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes,$out | Out-Null

Invoke-Checked $aapt2 @("compile", "--dir", (Join-Path $app "res"), "-o", $resZip)
Invoke-Checked $aapt2 @(
  "link", "-I", $androidJar,
  "--manifest", (Join-Path $app "AndroidManifest.xml"),
  "-o", $unsigned,
  $resZip,
  "--java", $build,
  "--min-sdk-version", "26",
  "--target-sdk-version", "36",
  "--version-code", [string]$versionCode,
  "--version-name", $version
)
Invoke-Checked "javac" @(
  "-source", "1.8",
  "-target", "1.8",
  "-bootclasspath", $androidJar,
  "-d", $classes,
  (Join-Path $app "src\main\java\com\gvault\app\MainActivity.java"),
  (Join-Path $build "com\gvault\app\R.java")
)
$classFiles = Get-ChildItem $classes -Recurse -Filter "*.class" | ForEach-Object FullName
Invoke-Checked $d8 (@("--lib", $androidJar, "--output", $build) + $classFiles)
Invoke-Checked $aapt2 @(
  "link", "-I", $androidJar,
  "--manifest", (Join-Path $app "AndroidManifest.xml"),
  "-o", $unaligned,
  $resZip,
  "--min-sdk-version", "26",
  "--target-sdk-version", "36",
  "--version-code", [string]$versionCode,
  "--version-name", $version
)
Invoke-Checked $jar @("uf", $unaligned, "-C", $build, "classes.dex")
Invoke-Checked $zipalign @("-f", "4", $unaligned, $apk)
Invoke-Checked $apksigner @(
  "sign",
  "--ks", $keystore,
  "--ks-key-alias", $keyAlias,
  "--ks-pass", "pass:$storePass",
  "--key-pass", "pass:$keyPass",
  $apk
)

& $apksigner verify --print-certs $apk | Out-File -Encoding utf8 (Join-Path $out "gvault-android-v$version.verify.txt")
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }

Write-Output $apk
