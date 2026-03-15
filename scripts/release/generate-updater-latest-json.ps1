param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$Target,

  [Parameter(Mandatory = $true)]
  [string]$PublicR2BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SignatureFile,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $false)]
  [string]$Notes = "Release notes are managed in GitHub Releases."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedSignatureFile = (Resolve-Path -LiteralPath $SignatureFile).Path
$signature = (Get-Content -Raw -LiteralPath $resolvedSignatureFile).Trim()
if ([string]::IsNullOrWhiteSpace($signature)) {
  throw "Signature file is empty: $resolvedSignatureFile"
}

$normalizedBaseUrl = $PublicR2BaseUrl.Trim().TrimEnd("/")
if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
  throw "PublicR2BaseUrl resolved to an empty string."
}

$downloadUrl = "$normalizedBaseUrl/releases/$Version/$Target/app.msi"
$pubDate = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")

$latestPayload = @{
  version = $Version
  notes = $Notes
  pub_date = $pubDate
  platforms = @{
    $Target = @{
      url = $downloadUrl
      signature = $signature
    }
  }
}

$resolvedOutputDirectory = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($resolvedOutputDirectory)) {
  New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null
}

$json = $latestPayload | ConvertTo-Json -Depth 6
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, "$json`n", $utf8NoBom)

Write-Host "Generated updater latest JSON: $OutputPath"
Write-Host "Download URL: $downloadUrl"
