$ErrorActionPreference = "Stop"

$env:HOST = "0.0.0.0"
if (-not $env:PORT) {
  $env:PORT = "4177"
}

$addresses = ipconfig |
  Select-String -Pattern "IPv4" |
  ForEach-Object { ($_ -split ":\s*", 2)[1].Trim() } |
  Where-Object {
    $_ -and
    -not $_.StartsWith("127.") -and
    $_ -notlike "169.254.*" -and
    $_ -ne "0.0.0.0"
  } |
  Select-Object -Unique

Write-Host ""
Write-Host "Work English Note"
Write-Host "Local: http://localhost:$env:PORT"
foreach ($address in $addresses) {
  Write-Host "LAN:   http://$address`:$env:PORT"
}
Write-Host ""
Write-Host "If another device cannot open the LAN URL, allow Node.js through Windows Defender Firewall for private networks."
Write-Host ""

node server.js
