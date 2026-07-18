param(
  [string]$AndroidSerial = ""
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host "==> $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Run-Step "npm install audit" { npm install }
Run-Step "workspace build lint unit integration smoke" { npm run check }
Run-Step "windows desktop build" { npm run build:windows }
Run-Step "linux desktop build" { npm run build:linux }
Run-Step "android apk build" { npm run build:android }
Run-Step "server web chrome edge windows linux e2e" { npm run e2e }
Run-Step "firefox extension lint" { npx -y web-ext lint --source-dir apps/browser-extension/dist/firefox }
Run-Step "firefox packaged extension e2e" { npm run smoke:firefox-extension }

if ($AndroidSerial) {
  Run-Step "android device e2e $AndroidSerial" {
    npm run e2e:android-device -- -Serial $AndroidSerial
  }
} else {
  $device = adb devices -l | Select-String " device " | ForEach-Object { ($_ -split "\s+")[0] } | Select-Object -First 1
  if ($device) {
    Run-Step "android device e2e $device" {
      npm run e2e:android-device -- -Serial $device
    }
  } else {
    Write-Host "==> android device e2e skipped: no authorized Android device"
  }
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Run-Step "docker compose config" { docker compose -f infra/compose/compose.yaml config --quiet }
} else {
  Write-Host "==> docker compose runtime skipped: docker CLI not installed"
}

Write-Host "all-platform e2e ok"
