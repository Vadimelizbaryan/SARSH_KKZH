param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$desktopProject = Join-Path $repoRoot "windows\MAINFLOW.Desktop\MAINFLOW.Desktop.csproj"
$setupProject = Join-Path $repoRoot "windows\MAINFLOW.Desktop.Setup\MAINFLOW.Desktop.Setup.csproj"
$desktopReleaseDir = Join-Path $repoRoot "windows\releases\MAINFLOW.Desktop"
$setupOutputExe = Join-Path $repoRoot "windows\releases\Mainflow.exe"
$legacySetupOutputExe = Join-Path $repoRoot "windows\releases\MAINFLOW.Desktop.Setup.exe"
$manifestPath = Join-Path $desktopReleaseDir "package-manifest.json"
$tempRoot = Join-Path $repoRoot "windows\.tmp"
$setupPublishDir = Join-Path $tempRoot "desktop-setup-publish"

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
if (Test-Path $legacySetupOutputExe) {
  Remove-Item $legacySetupOutputExe -Force
}

Write-Host "Publishing desktop shell..."
dotnet publish $desktopProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o $desktopReleaseDir

if (Test-Path $setupPublishDir) {
  Remove-Item $setupPublishDir -Recurse -Force
}

Write-Host "Publishing setup executable..."
dotnet publish $setupProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true `
  -p:DebugType=None `
  -o $setupPublishDir

Copy-Item -Path (Join-Path $setupPublishDir "MainflowSetup.exe") -Destination $setupOutputExe -Force

Write-Host "Generating package manifest..."
$manifestFiles = Get-ChildItem -Path $desktopReleaseDir -Recurse -File |
  Where-Object {
    $_.Name -ne "package-manifest.json" -and
    $_.Extension -ne ".pdb" -and
    $_.Name -notlike "desktop-test-*.png"
  } |
  ForEach-Object {
    $relativePath = $_.FullName.Substring($desktopReleaseDir.Length).TrimStart('\').Replace('\', '/')
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToUpperInvariant()
    [pscustomobject]@{
      path = $relativePath
      size = $_.Length
      sha256 = $hash
    }
  } |
  Sort-Object path

$manifest = [pscustomobject]@{
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  files = $manifestFiles
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Desktop release ready:"
Write-Host "  App:      $desktopReleaseDir"
Write-Host "  Manifest: $manifestPath"
Write-Host "  Setup:    $setupOutputExe"
