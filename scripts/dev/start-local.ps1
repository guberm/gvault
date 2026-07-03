$ErrorActionPreference = "Stop"

function Test-HttpOk {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$serverPort = 8080
if (-not (Test-HttpOk "http://127.0.0.1:$serverPort/healthz")) {
  if (Get-NetTCPConnection -State Listen -LocalPort $serverPort -ErrorAction SilentlyContinue) {
    $serverPort = 18080
  }
  $dataDir = Join-Path $env:TEMP "gvault-live-data"
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  $env:GV_DATA_DIR = $dataDir
  $env:GV_SERVER_HOST = "127.0.0.1"
  $env:GV_SERVER_PORT = [string]$serverPort
  $env:GV_ALLOWED_ORIGINS = "*"
  Start-Process -FilePath node -ArgumentList @("apps/server/dist/index.js") -WorkingDirectory (Get-Location) -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2
}

$webPort = 5173
if (-not (Test-HttpOk "http://127.0.0.1:$webPort/")) {
  if (Get-NetTCPConnection -State Listen -LocalPort $webPort -ErrorAction SilentlyContinue) {
    $webPort = 15173
  }
  Start-Process -FilePath node -ArgumentList @("scripts/dev/serve-web.mjs", (Join-Path (Get-Location) "apps/web/dist"), [string]$webPort) -WorkingDirectory (Get-Location) -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 1
}

$health = Invoke-RestMethod "http://127.0.0.1:$serverPort/healthz"
if ($health.product -ne "GVault") { throw "GVault server health check failed." }
if (-not (Test-HttpOk "http://127.0.0.1:$webPort/")) { throw "GVault web check failed." }

[pscustomobject]@{
  ServerUrl = "http://127.0.0.1:$serverPort"
  WebUrl = "http://127.0.0.1:$webPort"
  ServerHealth = $health
} | ConvertTo-Json -Depth 5
