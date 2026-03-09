param(
  [Parameter(Mandatory = $true)]
  [string]$BucketName,

  [Parameter(Mandatory = $true)]
  [string]$ObjectPrefix,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedArtifactDirectory = (Resolve-Path -LiteralPath $ArtifactDirectory).Path
$artifactNames = @("app.msi", "app.msi.sig")
$uploadedObjects = New-Object System.Collections.Generic.List[string]
$cleanupFailures = New-Object System.Collections.Generic.List[string]

try {
  foreach ($artifactName in $artifactNames) {
    $artifactPath = Join-Path $resolvedArtifactDirectory $artifactName
    if (-not (Test-Path -LiteralPath $artifactPath)) {
      throw "Missing normalized artifact: $artifactPath"
    }

    $objectPath = "$BucketName/$ObjectPrefix/$artifactName"
    Write-Host "Uploading $artifactName to $objectPath"

    & npx wrangler r2 object put $objectPath --file $artifactPath --remote
    if ($LASTEXITCODE -ne 0) {
      throw "wrangler r2 object put failed for $objectPath"
    }

    [void]$uploadedObjects.Add($objectPath)
  }
} catch {
  for ($index = $uploadedObjects.Count - 1; $index -ge 0; $index -= 1) {
    $uploadedObject = $uploadedObjects[$index]
    Write-Warning "Upload failed. Deleting already uploaded object: $uploadedObject"

    & npx wrangler r2 object delete $uploadedObject --remote
    if ($LASTEXITCODE -ne 0) {
      [void]$cleanupFailures.Add($uploadedObject)
    }
  }

  if ($cleanupFailures.Count -gt 0) {
    $failedCleanupList = $cleanupFailures -join ", "
    throw "R2 upload failed and cleanup also failed for: $failedCleanupList"
  }

  throw
}
