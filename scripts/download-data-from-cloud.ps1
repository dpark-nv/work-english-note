$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [string] $CloudUrl,

  [Parameter(Mandatory = $true)]
  [string] $Password,

  [string] $OutFile = "C:\Users\dpark\work-english-note\data\cloud-export.json"
)

$baseUrl = $CloudUrl.TrimEnd("/")
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ password = $Password } | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -WebSession $session | Out-Null

$export = Invoke-RestMethod -Uri "$baseUrl/api/export" -WebSession $session
$export | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutFile -Encoding UTF8
Write-Host "Saved $OutFile"
