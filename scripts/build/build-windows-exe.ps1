$ErrorActionPreference = "Stop"
$project = "apps\desktop\windows\GVault.Desktop.csproj"
$out = "apps\desktop\dist\windows-x64"
Remove-Item -LiteralPath $out -Recurse -Force -ErrorAction SilentlyContinue
dotnet publish $project -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o $out
Get-ChildItem $out -Filter "*.exe" | Select-Object -First 1 -ExpandProperty FullName
