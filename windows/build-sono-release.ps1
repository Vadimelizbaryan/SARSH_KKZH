param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$desktopProject = Join-Path $repoRoot "windows\SONO.Desktop\SONO.Desktop.csproj"
$setupProject = Join-Path $repoRoot "windows\SONO.Desktop.Setup\SONO.Desktop.Setup.csproj"
$desktopReleaseDir = Join-Path $repoRoot "windows\releases\SONO.Desktop"
$setupOutputExe = Join-Path $repoRoot "windows\releases\Sono.exe"
$manifestPath = Join-Path $desktopReleaseDir "package-manifest.json"
$tempRoot = Join-Path $repoRoot "windows\.tmp"
$setupPublishDir = Join-Path $tempRoot "sono-setup-publish"

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

Write-Host "Publishing SONO desktop shell..."
dotnet publish $desktopProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o $desktopReleaseDir

if ($LASTEXITCODE -ne 0) {
  throw "SONO desktop publish failed."
}

if (Test-Path $setupPublishDir) {
  Remove-Item $setupPublishDir -Recurse -Force
}

Write-Host "Publishing SONO setup executable..."
dotnet publish $setupProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true `
  -p:DebugType=None `
  -o $setupPublishDir

if ($LASTEXITCODE -ne 0) {
  throw "SONO setup publish failed."
}

Copy-Item -Path (Join-Path $setupPublishDir "SonoSetup.exe") -Destination $setupOutputExe -Force

Write-Host "Generating SONO package manifest..."
$manifestFiles = Get-ChildItem -Path $desktopReleaseDir -Recurse -File |
  Where-Object {
    $_.Name -ne "package-manifest.json" -and
    $_.Extension -ne ".pdb"
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

Write-Host "SONO desktop release ready:"
Write-Host "  App:      $desktopReleaseDir"
Write-Host "  Manifest: $manifestPath"
Write-Host "  Setup:    $setupOutputExe"
