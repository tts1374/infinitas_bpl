param(
  [Parameter(Mandatory = $true)]
  [string]$BundleDirectory,

  [Parameter(Mandatory = $true)]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-SingleArtifact {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SearchRoot,

    [Parameter(Mandatory = $true)]
    [string]$Pattern,

    [Parameter(Mandatory = $true)]
    [string]$VersionSubstring,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $matches = @(Get-ChildItem -LiteralPath $SearchRoot -Recurse -File -Filter $Pattern |
    Where-Object { $_.Name.Contains($VersionSubstring) } |
    Sort-Object FullName)

  if ($matches.Count -eq 0) {
    throw "Missing $Label artifact in $SearchRoot for version $VersionSubstring."
  }

  if ($matches.Count -gt 1) {
    $details = ($matches | ForEach-Object { $_.FullName }) -join [Environment]::NewLine
    throw "Expected exactly one $Label artifact in $SearchRoot for version $VersionSubstring, found $($matches.Count):$([Environment]::NewLine)$details"
  }

  return $matches[0]
}

$resolvedBundleDirectory = (Resolve-Path -LiteralPath $BundleDirectory).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$msiFile = Get-SingleArtifact -SearchRoot $resolvedBundleDirectory -Pattern "*.msi" -VersionSubstring $Version -Label ".msi"
$sigFile = Get-SingleArtifact -SearchRoot $resolvedBundleDirectory -Pattern "*.msi.sig" -VersionSubstring $Version -Label ".msi.sig"

$normalizedMsiPath = Join-Path $OutputDirectory "app.msi"
$normalizedSigPath = Join-Path $OutputDirectory "app.msi.sig"

Copy-Item -LiteralPath $msiFile.FullName -Destination $normalizedMsiPath -Force
Copy-Item -LiteralPath $sigFile.FullName -Destination $normalizedSigPath -Force

Write-Host "Collected MSI: $($msiFile.FullName)"
Write-Host "Collected signature: $($sigFile.FullName)"
Write-Host "Normalized MSI path: $normalizedMsiPath"
Write-Host "Normalized signature path: $normalizedSigPath"
