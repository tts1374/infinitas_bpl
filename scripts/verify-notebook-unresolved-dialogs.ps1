param(
  [string]$Instance = "p1",
  [string]$RuntimeRoot = "testdata/runtime",
  [int]$LogWaitSeconds = 12,
  [switch]$DryRun
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

function Apply-Fixture([string]$Scenario) {
  & $applyScriptPath -Scenario $Scenario -Instance $Instance -RuntimeRoot $RuntimeRoot
}

function Get-LogLineCount([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }

  return (Get-Content -LiteralPath $Path -Encoding UTF8).Count
}

function Wait-LogEvidence(
  [string]$Path,
  [int]$LineCountBefore,
  [string]$ExpectedToken,
  [string]$ExpectedTimestamp
) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{
      Passed = $false
      Message = "log file not found: $Path"
    }
  }

  $deadline = (Get-Date).AddSeconds($LogWaitSeconds)
  while ((Get-Date) -lt $deadline) {
    $lines = Get-Content -LiteralPath $Path -Encoding UTF8
    if ($lines.Count -gt $LineCountBefore) {
      $newLines = $lines[$LineCountBefore..($lines.Count - 1)]
      foreach ($line in $newLines) {
        if ($line -like "*$ExpectedToken*" -and $line -like "*$ExpectedTimestamp*") {
          return [pscustomobject]@{
            Passed = $true
            Message = $line
          }
        }
      }
    }
    Start-Sleep -Milliseconds 400
  }

  return [pscustomobject]@{
    Passed = $false
    Message = "no matching log line found within ${LogWaitSeconds}s (token='$ExpectedToken', timestamp='$ExpectedTimestamp')."
  }
}

function Ask-CheckResult([string]$Prompt) {
  while ($true) {
    $inputValue = (Read-Host "$Prompt [y/n]").Trim().ToLowerInvariant()
    if ($inputValue -eq "y" -or $inputValue -eq "n") {
      return $inputValue
    }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$applyScriptPath = Join-Path $repoRoot "scripts/apply-notebook-unresolved-fixture.ps1"
if (-not (Test-Path -LiteralPath $applyScriptPath)) {
  throw "apply script not found: $applyScriptPath"
}

$runtimeRootPath = if ([System.IO.Path]::IsPathRooted($RuntimeRoot)) {
  $RuntimeRoot
} else {
  Join-Path $repoRoot $RuntimeRoot
}
$logPath = Join-Path $runtimeRootPath "logs/$Instance-tauri.log"

$steps = @(
  [pscustomobject]@{
    Name = "unresolved_alias (skip)"
    Scenario = "unresolved_alias"
    ExpectedToken = "inf-notebook unresolved_alias:"
    ExpectedTimestamp = "20260313-010100"
    ManualCheck = @(
      "Dialog title: Registered chart does not match",
      "Mismatch reason text: Mismatch: Song title / Difficulty",
      "Default focus: Skip this time",
      "Action: click Skip this time"
    )
  },
  [pscustomobject]@{
    Name = "unresolved_alias (accept)"
    Scenario = "unresolved_alias"
    ExpectedToken = "inf-notebook unresolved_alias:"
    ExpectedTimestamp = "20260313-010100"
    ManualCheck = @(
      "The same dialog appears again",
      "Action: click Register",
      "Expected: one-time register to current round expected chart"
    )
  },
  [pscustomobject]@{
    Name = "resolved_partial"
    Scenario = "resolved_partial"
    ExpectedToken = "inf-notebook resolved_partial:"
    ExpectedTimestamp = "20260313-010200"
    ManualCheck = @(
      "Dialog title: Could not identify score",
      "Button: Close only",
      "Expected: not registered"
    )
  },
  [pscustomobject]@{
    Name = "ambiguous_recent"
    Scenario = "ambiguous_recent"
    ExpectedToken = "inf-notebook ambiguous_recent:"
    ExpectedTimestamp = "20260313-010300"
    ManualCheck = @(
      "Dialog title: Could not identify score uniquely",
      "Error code: NB-AMBIGUOUS-RECENT",
      "Candidate count is displayed",
      "Expected: not registered"
    )
  }
)

Write-Host "Preparing baseline fixture..." -ForegroundColor Cyan
Apply-Fixture "baseline"

Write-Host ""
Write-Host "Manual prerequisites before continuing:" -ForegroundColor Yellow
Write-Host "1. room_state = PLAYING"
Write-Host "2. source = inf-notebook"
Write-Host "3. Recommended current round expected: Thunderbolt / SP / ANOTHER (for clear unresolved_alias check)"
if ($DryRun) {
  Write-Host ""
  Write-Host "DryRun mode: no interactive prompts." -ForegroundColor Cyan
  foreach ($step in $steps) {
    Write-Host "- $($step.Name) -> scenario=$($step.Scenario), token=$($step.ExpectedToken), timestamp=$($step.ExpectedTimestamp)"
  }
  exit 0
}
Read-Host "Press Enter when ready"

$results = @()
foreach ($step in $steps) {
  Write-Host ""
  Write-Host "=== $($step.Name) ===" -ForegroundColor Cyan
  $beforeCount = Get-LogLineCount $logPath
  Apply-Fixture $step.Scenario
  $logResult = Wait-LogEvidence -Path $logPath -LineCountBefore $beforeCount -ExpectedToken $step.ExpectedToken -ExpectedTimestamp $step.ExpectedTimestamp

  Write-Host "Manual check points:" -ForegroundColor Yellow
  foreach ($line in $step.ManualCheck) {
    Write-Host " - $line"
  }

  $manualResult = Ask-CheckResult "Enter y if UI matches expected"
  $notes = Read-Host "Notes (optional)"

  $results += [pscustomobject]@{
    name = $step.Name
    scenario = $step.Scenario
    log_passed = $logResult.Passed
    log_evidence = $logResult.Message
    ui_passed = ($manualResult -eq "y")
    notes = $notes
  }
}

$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$reportPath = Join-Path $runtimeRootPath "logs/notebook-unresolved-dialog-check-$Instance-$timestamp.md"

$reportLines = @(
  "# notebook unresolved dialogs manual check",
  "",
  "- instance: $Instance",
  "- log: $logPath",
  "- generated_at: $([DateTimeOffset]::Now.ToString('o'))",
  "",
  "## Results"
)

foreach ($result in $results) {
  $reportLines += ""
  $reportLines += "### $($result.name)"
  $reportLines += "- scenario: $($result.scenario)"
  $reportLines += "- log_check: $(if ($result.log_passed) { "pass" } else { "fail" })"
  $reportLines += "- ui_check: $(if ($result.ui_passed) { "pass" } else { "fail" })"
  $reportLines += "- log_evidence: $($result.log_evidence)"
  if ([string]::IsNullOrWhiteSpace($result.notes)) {
    $reportLines += "- notes: (none)"
  } else {
    $reportLines += "- notes: $($result.notes)"
  }
}

$reportContent = ($reportLines -join "`n") + "`n"
Write-Utf8NoBomFile -Path $reportPath -Content $reportContent

Write-Host ""
Write-Host "Verification report written:" -ForegroundColor Green
Write-Host $reportPath
