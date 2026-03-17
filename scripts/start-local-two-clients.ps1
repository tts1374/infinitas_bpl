param(
  [ValidateRange(2, 4)]
  [int]$ClientCount = 2,
  [switch]$SkipWorker,
  [switch]$SkipFrontend
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

function Test-PortOpen([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $asyncResult = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $asyncResult.AsyncWaitHandle.WaitOne(500)) {
      return $false
    }

    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-PortOpen([int]$Port, [string]$Label, [int]$TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $Port) {
      return
    }

    Start-Sleep -Milliseconds 500
  }

  throw "$Label did not open port $Port within $TimeoutSeconds seconds."
}

function Start-LoggedPowerShell(
  [string]$Title,
  [string]$WorkingDirectory,
  [string]$Command,
  [string]$LogPath,
  [hashtable]$EnvVars = @{}
) {
  $titleLiteral = $Title.Replace("'", "''")
  $workingLiteral = $WorkingDirectory.Replace("'", "''")
  $logLiteral = $LogPath.Replace("'", "''")
  $commandLiteral = $Command.Replace("'", "''")
  $launcherPath = [System.IO.Path]::ChangeExtension($LogPath, ".launcher.ps1")

  $envLines = @(
    foreach ($entry in $EnvVars.GetEnumerator() | Sort-Object Key) {
      $valueLiteral = [string]$entry.Value
      $valueLiteral = $valueLiteral.Replace("'", "''")
      "`$env:$($entry.Key) = '$valueLiteral'"
    }
  )

  $debugEnvCleanupLines = @(
    "Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue"
    "Remove-Item Env:VSCODE_INSPECTOR_OPTIONS -ErrorAction SilentlyContinue"
  )

  $scriptLines = @(
    "`$ErrorActionPreference = 'Stop'"
    "`$Host.UI.RawUI.WindowTitle = '$titleLiteral'"
    "Set-Location '$workingLiteral'"
    $debugEnvCleanupLines
    $envLines
    "& { $commandLiteral } 2>&1 | Tee-Object -FilePath '$logLiteral'"
  )

  # Ensure downstream checks can find the log path immediately after startup.
  if (-not (Test-Path -LiteralPath $LogPath)) {
    Write-Utf8NoBomFile $LogPath ""
  }

  Write-Utf8NoBomFile $launcherPath (($scriptLines -join "`n") + "`n")
  $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
  $shellExe = if ($pwshCommand) { $pwshCommand.Source } else { "powershell" }
  Start-Process -FilePath $shellExe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $launcherPath | Out-Null
}

function New-ClientSpec([int]$Index, [string]$RuntimeRoot, [string]$ConfigRoot, [string]$LogRoot) {
  $id = "p$Index"
  $label = "Local P$Index"
  $displayName = "Local$Index"
  $playerId = "local-p$Index"
  $instanceRoot = Join-Path $RuntimeRoot "instances\$id"
  $dakenDir = Join-Path $instanceRoot "inf_daken_counter"
  $notebookExportDir = Join-Path $instanceRoot "inf-notebook\export"
  $notebookRecordsDir = Join-Path $instanceRoot "inf-notebook\records"

  foreach ($path in @($dakenDir, $notebookExportDir, $notebookRecordsDir)) {
    Ensure-Directory $path
  }

  [pscustomobject]@{
    Id = $id
    Label = $label
    DisplayName = $displayName
    PlayerId = $playerId
    WindowTitle = "INFINITAS ARENA Client ($label)"
    DakenFile = Join-Path $dakenDir "today_update.xml"
    NotebookExportFile = Join-Path $notebookExportDir "recent.json"
    NotebookRecordsFile = Join-Path $notebookRecordsDir "summary.json"
    CargoTargetDir = Join-Path $RuntimeRoot "cargo-target\$id"
    ConfigPath = Join-Path $ConfigRoot "$id.tauri.dev.json"
    LogPath = Join-Path $LogRoot "$id-tauri.log"
  }
}

function Build-QueryString([pscustomobject]$Spec) {
  $queryParams = [ordered]@{
    instance = $Spec.Id
    label = $Spec.Label
    name = $Spec.DisplayName
    playerId = $Spec.PlayerId
    api = "http://127.0.0.1:8787"
    source = "inf-notebook"
    dakenPath = $Spec.DakenFile
    notebookPath = $Spec.NotebookExportFile
    recordsPath = $Spec.NotebookRecordsFile
  }

  $encoded = foreach ($entry in $queryParams.GetEnumerator()) {
    $key = [System.Uri]::EscapeDataString([string]$entry.Key)
    $value = [System.Uri]::EscapeDataString([string]$entry.Value)
    "$key=$value"
  }

  return "?" + ($encoded -join "&")
}

function Write-TauriDevConfig([pscustomobject]$Spec) {
  $config = [ordered]@{
    build = [ordered]@{
      beforeDevCommand = "cmd /c exit 0"
      devUrl = "http://localhost:1420$(Build-QueryString $Spec)"
    }
    app = [ordered]@{
      windows = @(
        [ordered]@{
          label = "main"
          title = $Spec.WindowTitle
          width = 1280
          height = 900
          minWidth = 1024
          minHeight = 720
          resizable = $true
        }
      )
    }
  }

  Write-Utf8NoBomFile $Spec.ConfigPath (($config | ConvertTo-Json -Depth 8) + "`n")
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$clientRoot = Join-Path $repoRoot "apps\client"
$runtimeRoot = Join-Path $repoRoot "testdata\runtime"
$logRoot = Join-Path $runtimeRoot "logs"
$configRoot = Join-Path $runtimeRoot "tauri-config"

Ensure-Directory $runtimeRoot
Ensure-Directory $logRoot
Ensure-Directory $configRoot

$workerLog = Join-Path $logRoot "worker.log"
$frontendLog = Join-Path $logRoot "client-dev.log"
$clients = @(1..$ClientCount | ForEach-Object { New-ClientSpec -Index $_ -RuntimeRoot $runtimeRoot -ConfigRoot $configRoot -LogRoot $logRoot })

foreach ($client in $clients) {
  Ensure-Directory $client.CargoTargetDir
  Write-TauriDevConfig $client
}

if (-not $SkipWorker -and -not (Test-PortOpen 8787)) {
  Start-LoggedPowerShell `
    -Title "INFINITAS Worker Dev" `
    -WorkingDirectory $repoRoot `
    -Command "npm --workspace @infinitas/worker run dev" `
    -LogPath $workerLog
  Wait-PortOpen -Port 8787 -Label "Worker Dev"
}

if (-not $SkipFrontend -and -not (Test-PortOpen 1420)) {
  Start-LoggedPowerShell `
    -Title "INFINITAS Client Dev Server" `
    -WorkingDirectory $repoRoot `
    -Command "npm --workspace @infinitas/client run dev" `
    -LogPath $frontendLog
  Wait-PortOpen -Port 1420 -Label "Client Dev Server"
}

foreach ($client in $clients) {
  Start-LoggedPowerShell `
    -Title $client.WindowTitle `
    -WorkingDirectory $clientRoot `
    -Command "npm exec -- tauri dev --config `"$($client.ConfigPath)`" --no-dev-server-wait" `
    -LogPath $client.LogPath `
    -EnvVars @{
      INFINITAS_INSTANCE_ID = $client.Id
      CARGO_TARGET_DIR = $client.CargoTargetDir
    }
}

Write-Host "Started $ClientCount local client instance(s)." -ForegroundColor Green
Write-Host "Runtime files: $runtimeRoot"
