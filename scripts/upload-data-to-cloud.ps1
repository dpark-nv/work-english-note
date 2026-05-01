$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [string] $CloudUrl,

  [Parameter(Mandatory = $true)]
  [string] $Password,

  [string] $DataFile = "C:\Users\dpark\work-english-note\data\sentences.json",

  [ValidateSet("merge", "replace")]
  [string] $Mode = "merge"
)

$baseUrl = $CloudUrl.TrimEnd("/")
if (-not (Test-Path -LiteralPath $DataFile)) {
  throw "Data file not found: $DataFile"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ password = $Password } | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -WebSession $session | Out-Null

$store = Get-Content -LiteralPath $DataFile -Raw | ConvertFrom-Json
$payload = @{
  mode = $Mode
  entries = @($store.entries)
} | ConvertTo-Json -Depth 100

$result = Invoke-RestMethod -Uri "$baseUrl/api/import" -Method Post -ContentType "application/json" -Body $payload -WebSession $session
$result | ConvertTo-Json
