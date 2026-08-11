[CmdletBinding()]
param(
    [string]$KeystorePath = "$env:LOCALAPPDATA\Mainform\signing\mainform-release.jks",
    [string]$PasswordFile = "$env:LOCALAPPDATA\Mainform\signing\mainform-release.password.dpapi",
    [string]$ProjectPath,
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    $ProjectPath = Join-Path $PSScriptRoot "MAINFORM\MAINFORM.csproj"
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "releases\MAINFORM.apk"
}

$dotnet = "C:\Program Files\dotnet\dotnet.exe"
$androidSdk = "$env:LOCALAPPDATA\Android\Sdk"
$javaSdk = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
if (-not (Test-Path -LiteralPath $dotnet)) {
    throw "The .NET SDK was not found at $dotnet."
}
if (-not (Test-Path -LiteralPath (Join-Path $androidSdk "platforms\android-34\android.jar"))) {
    throw "Android SDK platform 34 is missing at $androidSdk."
}
if (-not (Test-Path -LiteralPath (Join-Path $javaSdk "bin\java.exe"))) {
    throw "Java 17 was not found at $javaSdk."
}
if (-not (Test-Path -LiteralPath $KeystorePath) -or -not (Test-Path -LiteralPath $PasswordFile)) {
    throw "The local MAINFORM release signing key is missing."
}

$encryptedPassword = (Get-Content -LiteralPath $PasswordFile -Raw).Trim()
$securePassword = ConvertTo-SecureString $encryptedPassword
$passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
    & $dotnet publish $ProjectPath `
        --configuration Release `
        --framework net8.0-android `
        -p:AndroidPackageFormat=apk `
        -p:AndroidKeyStore=true `
        -p:AndroidSigningKeyStore=$KeystorePath `
        -p:AndroidSigningStorePass=$password `
        -p:AndroidSigningKeyAlias=mainform-release `
        -p:AndroidSigningKeyPass=$password `
        -p:AndroidSdkDirectory=$androidSdk `
        -p:JavaSdkDirectory=$javaSdk
    if ($LASTEXITCODE -ne 0) {
        throw "The Android publish command failed with exit code $LASTEXITCODE."
    }

    $publishDirectory = Join-Path (Split-Path -Parent $ProjectPath) "bin\Release\net8.0-android\publish"
    $apk = Get-ChildItem -LiteralPath $publishDirectory -Filter "*.apk" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $apk) {
        throw "The Android publish command did not produce an APK."
    }

    Copy-Item -LiteralPath $apk.FullName -Destination $OutputPath -Force
    Write-Output "Release APK: $OutputPath"
}
finally {
    if ($passwordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
    }
}
