param(
  [ValidateSet("baseline", "unresolved_alias", "resolved_partial", "ambiguous_recent")]
  [string]$Scenario = "baseline",
  [string]$Instance = "p1",
  [string]$RuntimeRoot = "testdata/runtime"
)

$ErrorActionPreference = "Stop"

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $directory = Split-Path -Parent $Path
  if ($directory) {
    Ensure-Directory $directory
  }

  $encoding = [System.Text.UTF8Encoding]::new($false)
  $normalized = $Content -replace "`r?`n", "`n"
  [System.IO.File]::WriteAllText($Path, $normalized, $encoding)
}

function Read-Utf8Text([string]$Path) {
  $encoding = [System.Text.UTF8Encoding]::new($false, $true)
  return [System.IO.File]::ReadAllText($Path, $encoding)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fixtureRoot = Join-Path $repoRoot "testdata/notebook-unresolved-dialogs/$Scenario"
$fixtureSummaryPath = Join-Path $fixtureRoot "records/summary.json"
$fixtureRecentPath = Join-Path $fixtureRoot "export/recent.json"

if (-not (Test-Path -LiteralPath $fixtureSummaryPath)) {
  throw "Fixture summary.json not found: $fixtureSummaryPath"
}
if (-not (Test-Path -LiteralPath $fixtureRecentPath)) {
  throw "Fixture recent.json not found: $fixtureRecentPath"
}

$runtimeRootPath = if ([System.IO.Path]::IsPathRooted($RuntimeRoot)) {
  $RuntimeRoot
} else {
  Join-Path $repoRoot $RuntimeRoot
}
$targetRoot = Join-Path $runtimeRootPath "instances/$Instance/inf-notebook"
$targetSummaryPath = Join-Path $targetRoot "records/summary.json"
$targetRecentPath = Join-Path $targetRoot "export/recent.json"

Write-Utf8NoBomFile -Path $targetSummaryPath -Content (Read-Utf8Text $fixtureSummaryPath)
Write-Utf8NoBomFile -Path $targetRecentPath -Content (Read-Utf8Text $fixtureRecentPath)

Write-Host "Applied fixture: $Scenario" -ForegroundColor Green
Write-Host "Target summary: $targetSummaryPath"
Write-Host "Target recent : $targetRecentPath"
