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
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path $sdk)) { throw "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT." }

$platform = Get-ChildItem (Join-Path $sdk "platforms") -Directory | Sort-Object Name -Descending | Select-Object -First 1
$buildTools = Get-ChildItem (Join-Path $sdk "build-tools") -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $platform -or -not $buildTools) { throw "Android platform/build-tools not found in $sdk." }

$aapt2 = Join-Path $buildTools.FullName "aapt2.exe"
$d8 = Join-Path $buildTools.FullName "d8.bat"
$zipalign = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"
$androidJar = Join-Path $platform.FullName "android.jar"
$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool) {
  $keytool = "C:\Program Files\Java\jdk-22\bin\keytool.exe"
}
if (-not (Test-Path $keytool)) { throw "keytool.exe not found." }
$jar = (Get-Command jar -ErrorAction SilentlyContinue).Source
if (-not $jar) {
  $jar = "C:\Program Files\Java\jdk-22\bin\jar.exe"
}
if (-not (Test-Path $jar)) { throw "jar.exe not found." }

$root = Resolve-Path "."
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$app = Join-Path $root "apps\mobile\android"
$build = Join-Path $root "apps\mobile\build\android"
$out = Join-Path $root "apps\mobile\dist"
$classes = Join-Path $build "classes"
$resZip = Join-Path $build "res.zip"
$unsigned = Join-Path $build "gvault-unsigned.apk"
$unaligned = Join-Path $build "gvault-unaligned.apk"
$apk = Join-Path $out "gvault-android-v$version.apk"
$keystore = Join-Path $build "gvault-debug.keystore"

Remove-Item -LiteralPath $build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes,$out | Out-Null

Invoke-Checked $aapt2 @("compile", "--dir", (Join-Path $app "res"), "-o", $resZip)
Invoke-Checked $aapt2 @("link", "-I", $androidJar, "--manifest", (Join-Path $app "AndroidManifest.xml"), "-o", $unsigned, $resZip, "--java", $build, "--min-sdk-version", "26", "--target-sdk-version", "36", "--version-code", "2", "--version-name", $version)
Invoke-Checked "javac" @("-source", "1.8", "-target", "1.8", "-bootclasspath", $androidJar, "-d", $classes, (Join-Path $app "src\main\java\com\gvault\app\MainActivity.java"), (Join-Path $build "com\gvault\app\R.java"))
$classFiles = Get-ChildItem $classes -Recurse -Filter "*.class" | ForEach-Object FullName
Invoke-Checked $d8 (@("--lib", $androidJar, "--output", $build) + $classFiles)
Invoke-Checked $aapt2 @("link", "-I", $androidJar, "--manifest", (Join-Path $app "AndroidManifest.xml"), "-o", $unaligned, $resZip, "--min-sdk-version", "26", "--target-sdk-version", "36", "--version-code", "2", "--version-name", $version)
Invoke-Checked $jar @("uf", $unaligned, "-C", $build, "classes.dex")
Invoke-Checked $zipalign @("-f", "4", $unaligned, $apk)

Invoke-Checked $keytool @("-genkeypair", "-v", "-keystore", $keystore, "-storepass", "android", "-keypass", "android", "-alias", "gvault", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=GVault Debug,O=GVault,C=US")
Invoke-Checked $apksigner @("sign", "--ks", $keystore, "--ks-key-alias", "gvault", "--ks-pass", "pass:android", "--key-pass", "pass:android", $apk)
& $apksigner verify --print-certs $apk | Out-File -Encoding utf8 (Join-Path $out "gvault-android-v$version.verify.txt")
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }

Write-Output $apk
