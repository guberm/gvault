$ErrorActionPreference = "Stop"
$project = "apps\desktop\linux\GVault.Desktop.Linux.csproj"
$out = "apps\desktop\dist\linux-x64"
Remove-Item -LiteralPath $out -Recurse -Force -ErrorAction SilentlyContinue
dotnet publish $project -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=false -o $out
Get-ChildItem $out -File | Select-Object Name,Length
