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
      Message = "ログファイルが見つかりません: $Path"
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
    Message = "${LogWaitSeconds}秒以内に一致するログ行が見つかりませんでした (token='$ExpectedToken', timestamp='$ExpectedTimestamp')."
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
  throw "applyスクリプトが見つかりません: $applyScriptPath"
}

$runtimeRootPath = if ([System.IO.Path]::IsPathRooted($RuntimeRoot)) {
  $RuntimeRoot
} else {
  Join-Path $repoRoot $RuntimeRoot
}
$logPath = Join-Path $runtimeRootPath "logs/$Instance-tauri.log"
$instanceNotebookRoot = Join-Path $runtimeRootPath "instances/$Instance/inf-notebook"
$instanceSummaryPath = Join-Path $instanceNotebookRoot "records/summary.json"
$instanceRecentPath = Join-Path $instanceNotebookRoot "export/recent.json"

if (-not (Test-Path -LiteralPath $instanceSummaryPath) -or -not (Test-Path -LiteralPath $instanceRecentPath)) {
  throw @"
検証対象の runtime インスタンスが見つかりません。
期待パス:
  - $instanceSummaryPath
  - $instanceRecentPath

先に以下でローカル検証環境を起動してください:
  pwsh -File scripts/start-local-two-clients.ps1 -ClientCount 2
"@
}

if (-not (Test-Path -LiteralPath $logPath) -and -not $DryRun) {
  throw @"
ログファイルが見つかりません: $logPath

このスクリプトは testdata/runtime のローカル検証クライアント（p1/p2）前提です。
先に以下でクライアントを起動してください:
  pwsh -File scripts/start-local-two-clients.ps1 -ClientCount 2
"@
}

$steps = @(
  [pscustomobject]@{
    Name = "unresolved_alias（スキップ）"
    Scenario = "unresolved_alias"
    ExpectedToken = "inf-notebook summary diff processed:"
    ExpectedTimestamp = ""
    ManualCheck = @(
      "ダイアログタイトル: 登録先の譜面が一致しません",
      "不一致理由: 不一致（曲名 / 難易度）",
      "初期フォーカス: 今回は登録しない",
      "操作: [今回は登録しない] を押す"
    )
  },
  [pscustomobject]@{
    Name = "unresolved_alias（登録）"
    Scenario = "unresolved_alias"
    ExpectedToken = "inf-notebook summary diff processed:"
    ExpectedTimestamp = ""
    ManualCheck = @(
      "同じダイアログが再表示される",
      "操作: [登録する] を押す",
      "期待結果: 現在ラウンドの expected chart へ1回だけ登録される"
    )
  },
  [pscustomobject]@{
    Name = "resolved_partial"
    Scenario = "resolved_partial"
    ExpectedToken = "inf-notebook resolved_partial:"
    ExpectedTimestamp = "20260313-010200"
    ManualCheck = @(
      "ダイアログタイトル: スコアを特定できませんでした",
      "ボタン: 閉じる のみ",
      "期待結果: 登録されない"
    )
  },
  [pscustomobject]@{
    Name = "ambiguous_recent"
    Scenario = "ambiguous_recent"
    ExpectedToken = "inf-notebook ambiguous_recent:"
    ExpectedTimestamp = "20260313-010300"
    ManualCheck = @(
      "ダイアログタイトル: スコアを一意に特定できませんでした",
      "エラーコード: NB-AMBIGUOUS-RECENT",
      "候補数が表示される",
      "期待結果: 登録されない"
    )
  }
)

Write-Host ""
Write-Host "開始前の前提条件:" -ForegroundColor Yellow
Write-Host "1. room_state = PLAYING"
Write-Host "2. source = inf-notebook"
Write-Host "3. 現在ラウンド expected を Thunderbolt / SP / ANOTHER に合わせる（unresolved_alias確認を明確化）"
if ($DryRun) {
  if (-not (Test-Path -LiteralPath $logPath)) {
    Write-Host ""
    Write-Host "注意: ログファイルが未作成です。実行時は先にローカルクライアントを起動してください。" -ForegroundColor Yellow
    Write-Host "  pwsh -File scripts/start-local-two-clients.ps1 -ClientCount 2" -ForegroundColor Yellow
  }
  Write-Host ""
  Write-Host "DryRunモード: 対話入力は行いません。" -ForegroundColor Cyan
  foreach ($step in $steps) {
    Write-Host "- $($step.Name) -> scenario=$($step.Scenario), token=$($step.ExpectedToken), timestamp=$($step.ExpectedTimestamp)"
  }
  exit 0
}
Read-Host "準備できたら Enter を押してください"

$results = @()
foreach ($step in $steps) {
  Write-Host ""
  Write-Host "=== $($step.Name) ===" -ForegroundColor Cyan
  Write-Host "fixtureを baseline にリセットします" -ForegroundColor DarkGray
  Apply-Fixture "baseline"
  Start-Sleep -Milliseconds 300
  $beforeCount = Get-LogLineCount $logPath
  Apply-Fixture $step.Scenario
  $logResult = Wait-LogEvidence -Path $logPath -LineCountBefore $beforeCount -ExpectedToken $step.ExpectedToken -ExpectedTimestamp $step.ExpectedTimestamp

  Write-Host "手動チェック項目:" -ForegroundColor Yellow
  foreach ($line in $step.ManualCheck) {
    Write-Host " - $line"
  }

  $manualResult = Ask-CheckResult "UIが期待どおりなら y を入力"
  $notes = Read-Host "メモ（任意）"

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
  "# inf-notebook 未解決ダイアログ 手動確認レポート",
  "",
  "- instance: $Instance",
  "- log: $logPath",
  "- generated_at: $([DateTimeOffset]::Now.ToString('o'))",
  "",
  "## 結果"
)

foreach ($result in $results) {
  $reportLines += ""
  $reportLines += "### $($result.name)"
  $reportLines += "- scenario: $($result.scenario)"
  $reportLines += "- log_check: $(if ($result.log_passed) { "pass" } else { "fail" })"
  $reportLines += "- ui_check: $(if ($result.ui_passed) { "pass" } else { "fail" })"
  $reportLines += "- log_evidence: $($result.log_evidence)"
  if ([string]::IsNullOrWhiteSpace($result.notes)) {
    $reportLines += "- notes: (なし)"
  } else {
    $reportLines += "- notes: $($result.notes)"
  }
}

$reportContent = ($reportLines -join "`n") + "`n"
Write-Utf8NoBomFile -Path $reportPath -Content $reportContent

Write-Host ""
Write-Host "確認レポートを出力しました:" -ForegroundColor Green
Write-Host $reportPath
