[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$SiteBaseUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/bgej6lyx",
  [int]$QrImageSize = 320,
  [double]$HeaderQrSizePoints = 62,
  [double]$TopMarginPoints = 90
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$departmentsRoot = Join-Path $ProjectRoot "Отделения"
$qrRoot = Join-Path $ProjectRoot "qr-codes"
$manifestPath = Join-Path $qrRoot "qr-manifest.txt"

$mappings = @(
  [PSCustomObject]@{ Folder = "Վիրաբուժական"; Slug = "te9625wg" }
  [PSCustomObject]@{ Folder = "Դիմածնոտային վիր"; Slug = "1ei6dnv2" }
  [PSCustomObject]@{ Folder = "Քիթ-կոկորդ բ-ք"; Slug = "du9wa6oq" }
  [PSCustomObject]@{ Folder = "Ակնաբուժական"; Slug = "08xa44ew" }
  [PSCustomObject]@{ Folder = "Վնասվածքաբանական"; Slug = "v1914tm9" }
  [PSCustomObject]@{ Folder = "Կրծքային մ-բ"; Slug = "c3usp3r9" }
  [PSCustomObject]@{ Folder = "Ուռոլոգիական"; Slug = "g5u3jca0" }
  [PSCustomObject]@{ Folder = "Նեյրովիրաբուժական"; Slug = "4k6uv2xu" }
  [PSCustomObject]@{ Folder = "Թռիչքային"; Slug = "ltndeohl" }
  [PSCustomObject]@{ Folder = "Թերապիա"; Slug = "ptf9nvbv" }
  [PSCustomObject]@{ Folder = "Վերակենդանացման"; Slug = "9htuxle8" }
  [PSCustomObject]@{ Folder = "Նյարդաբանական"; Slug = "ldvp99z7" }
  [PSCustomObject]@{ Folder = "Գինեկոլոգիական"; Slug = "zzphaoqo" }
  [PSCustomObject]@{ Folder = "ԱՆՈԹԱՅԻՆ"; Slug = "4zby7qi3" }
  [PSCustomObject]@{ Folder = "ԻՆՖ"; Slug = "c5mv5bh4" }
  [PSCustomObject]@{ Folder = "ԱՏԴ"; Slug = "5s7rrwg9" }
  [PSCustomObject]@{ Folder = "Ք-Հ"; Slug = "3ofsacp6" }
)

New-Item -Path $qrRoot -ItemType Directory -Force | Out-Null

$entries = foreach ($mapping in $mappings) {
  $folderPath = Join-Path $departmentsRoot $mapping.Folder
  if (-not (Test-Path -LiteralPath $folderPath)) {
    throw "Folder not found: $folderPath"
  }

  $doc = Get-ChildItem -LiteralPath $folderPath -Filter *.docx | Select-Object -First 1
  if (-not $doc) {
    throw "DOCX not found in folder: $folderPath"
  }

  $url = "$SiteBaseUrl/$($mapping.Slug).html"
  $encodedUrl = [System.Uri]::EscapeDataString($url)
  $qrPath = Join-Path $qrRoot "$($mapping.Slug).png"
  $qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=${QrImageSize}x${QrImageSize}&margin=0&data=$encodedUrl"

  Invoke-WebRequest -Uri $qrApiUrl -OutFile $qrPath

  [PSCustomObject]@{
    Folder = $mapping.Folder
    Slug = $mapping.Slug
    Url = $url
    DocPath = $doc.FullName
    DocName = $doc.Name
    QrPath = $qrPath
  }
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$saveChanges = 0

try {
  foreach ($entry in $entries) {
    $document = $word.Documents.Open($entry.DocPath, $false, $false)
    try {
      $document.Content.ParagraphFormat.SpaceAfter = 0
      $document.Content.ParagraphFormat.LineSpacingRule = 4
      $document.Content.ParagraphFormat.LineSpacing = 12

      foreach ($section in $document.Sections) {
        $section.PageSetup.TopMargin = $TopMarginPoints
        $section.PageSetup.DifferentFirstPageHeaderFooter = $false
        $section.PageSetup.OddAndEvenPagesHeaderFooter = $false

        $header = $section.Headers.Item(1)
        $header.LinkToPrevious = $false
        $header.Range.Text = ""
        $header.Range.ParagraphFormat.Alignment = 2

        $insertRange = $header.Range.Duplicate
        $insertRange.Collapse(1)
        $shape = $insertRange.InlineShapes.AddPicture($entry.QrPath, $false, $true)
        $scalePercent = [Math]::Round(($HeaderQrSizePoints / [double]$shape.Width) * 100, 2)
        $shape.ScaleWidth = $scalePercent
        $shape.ScaleHeight = $scalePercent
        $shape.AlternativeText = "SARSH_KKZH_QR"
        $shape.Range.ParagraphFormat.Alignment = 2
      }

      $document.Save()
    }
    finally {
      $document.Close([ref]$saveChanges)
      [System.Runtime.Interopservices.Marshal]::ReleaseComObject($document) | Out-Null
    }
  }
}
finally {
  $word.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$manifestLines = @(
  "SARSH_KKZH QR manifest",
  ""
)

foreach ($entry in $entries) {
  $manifestLines += $entry.Folder
  $manifestLines += "Document: $($entry.DocName)"
  $manifestLines += "HTML: $($entry.Url)"
  $manifestLines += "QR: $($entry.QrPath)"
  $manifestLines += ""
}

Set-Content -LiteralPath $manifestPath -Value $manifestLines -Encoding UTF8

Write-Output "QR codes created in: $qrRoot"
Write-Output "Manifest saved to: $manifestPath"
Write-Output "Updated documents:"
$entries | Select-Object Folder, DocName, Slug | Format-Table -AutoSize
