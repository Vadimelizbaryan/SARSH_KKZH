$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetGridWidths = @(
    717, 717, 717, 717, 717, 717, 717, 717, 717, 717, 717,
    717, 717, 717, 717, 717, 717, 717, 717, 717, 717, 717
)
$wordPdfFormat = 17

Add-Type -AssemblyName System.IO.Compression.FileSystem

$cp1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$cornerTopPt = "110.75"
$cornerBottomPt = "229.5"
$cornerLeftMarginPt = "39.2"
$cornerRightMarginPt = "795.2"

function Repair-MojibakeText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $needsFix = $false
    foreach ($char in $Value.ToCharArray()) {
        $code = [int][char]$char
        if ($code -ge 0x00C0 -and $code -le 0x00FF) {
            $needsFix = $true
            break
        }
    }

    if (-not $needsFix) {
        return $Value
    }

    try {
        $bytes = $cp1252.GetBytes($Value)
        $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($fixed -and $fixed -ne $Value) {
            return $fixed
        }
    } catch {
    }

    return $Value
}

function Save-XmlUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$XmlDocument,
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $settings = New-Object System.Xml.XmlWriterSettings
    $settings.Encoding = $utf8NoBom
    $settings.Indent = $false
    $settings.NewLineHandling = [System.Xml.NewLineHandling]::None

    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try {
        $XmlDocument.Save($writer)
    } finally {
        $writer.Close()
    }
}

function Load-XmlDocument {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $xml = New-Object System.Xml.XmlDocument
    $xml.PreserveWhitespace = $true
    $xml.Load($Path)
    return $xml
}

function Set-WAttribute {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlElement]$Element,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $namespaceUri = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    $Element.SetAttribute($Name, $namespaceUri, $Value) | Out-Null
}

function Ensure-WordProofingSettings {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TempRoot
    )

    $wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    $ns = $null

    $settingsPath = Join-Path $TempRoot "word\settings.xml"
    if (Test-Path $settingsPath) {
        $settingsXml = Load-XmlDocument -Path $settingsPath
        $ns = New-Object System.Xml.XmlNamespaceManager($settingsXml.NameTable)
        $ns.AddNamespace("w", $wordNamespace)

        $settingsNode = $settingsXml.SelectSingleNode("/w:settings", $ns)
        if ($settingsNode) {
            if (-not $settingsNode.SelectSingleNode("./w:hideSpellingErrors", $ns)) {
                $hideSpelling = $settingsXml.CreateElement("w", "hideSpellingErrors", $wordNamespace)
                $settingsNode.AppendChild($hideSpelling) | Out-Null
            }

            if (-not $settingsNode.SelectSingleNode("./w:hideGrammaticalErrors", $ns)) {
                $hideGrammar = $settingsXml.CreateElement("w", "hideGrammaticalErrors", $wordNamespace)
                $settingsNode.AppendChild($hideGrammar) | Out-Null
            }

            $proofState = $settingsNode.SelectSingleNode("./w:proofState", $ns)
            if (-not $proofState) {
                $proofState = $settingsXml.CreateElement("w", "proofState", $wordNamespace)
                $settingsNode.AppendChild($proofState) | Out-Null
            }

            Set-WAttribute -Element $proofState -Name "spelling" -Value "clean"
            Set-WAttribute -Element $proofState -Name "grammar" -Value "clean"

            Save-XmlUtf8NoBom -XmlDocument $settingsXml -Path $settingsPath
        }
    }

    $stylesPath = Join-Path $TempRoot "word\styles.xml"
    if (Test-Path $stylesPath) {
        $stylesXml = Load-XmlDocument -Path $stylesPath
        $ns = New-Object System.Xml.XmlNamespaceManager($stylesXml.NameTable)
        $ns.AddNamespace("w", $wordNamespace)

        $stylesNode = $stylesXml.SelectSingleNode("/w:styles", $ns)
        if ($stylesNode) {
            $docDefaults = $stylesNode.SelectSingleNode("./w:docDefaults", $ns)
            if (-not $docDefaults) {
                $docDefaults = $stylesXml.CreateElement("w", "docDefaults", $wordNamespace)
                $stylesNode.PrependChild($docDefaults) | Out-Null
            }

            $rPrDefault = $docDefaults.SelectSingleNode("./w:rPrDefault", $ns)
            if (-not $rPrDefault) {
                $rPrDefault = $stylesXml.CreateElement("w", "rPrDefault", $wordNamespace)
                $docDefaults.AppendChild($rPrDefault) | Out-Null
            }

            $rPr = $rPrDefault.SelectSingleNode("./w:rPr", $ns)
            if (-not $rPr) {
                $rPr = $stylesXml.CreateElement("w", "rPr", $wordNamespace)
                $rPrDefault.AppendChild($rPr) | Out-Null
            }

            if (-not $rPr.SelectSingleNode("./w:noProof", $ns)) {
                $noProof = $stylesXml.CreateElement("w", "noProof", $wordNamespace)
                $rPr.AppendChild($noProof) | Out-Null
            }

            $langNode = $rPr.SelectSingleNode("./w:lang", $ns)
            if (-not $langNode) {
                $langNode = $stylesXml.CreateElement("w", "lang", $wordNamespace)
                $rPr.AppendChild($langNode) | Out-Null
            }

            Set-WAttribute -Element $langNode -Name "val" -Value "hy-AM"
            Set-WAttribute -Element $langNode -Name "bidi" -Value "hy-AM"

            Save-XmlUtf8NoBom -XmlDocument $stylesXml -Path $stylesPath
        }
    }
}

function Normalize-CornerMarksInXml {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$XmlDocument,
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlNamespaceManager]$NamespaceManager
    )

    $cornerMarks = $XmlDocument.SelectNodes("//v:rect[@alt='sarsh-corner-mark']", $NamespaceManager)
    foreach ($cornerMark in $cornerMarks) {
        $style = $cornerMark.GetAttribute("style")
        if (-not $style) {
            continue
        }

        $match = [regex]::Match($style, "margin-top:([0-9.]+)pt")
        if (-not $match.Success) {
            continue
        }

        $currentTop = 0.0
        if (-not [double]::TryParse($match.Groups[1].Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$currentTop)) {
            continue
        }

        $targetTop = if ($currentTop -lt 170.0) { $cornerTopPt } else { $cornerBottomPt }
        $updatedStyle = [regex]::Replace($style, "margin-top:[0-9.]+pt", "margin-top:$targetTop" + "pt", 1)
        if ($updatedStyle -ne $style) {
            $cornerMark.SetAttribute("style", $updatedStyle) | Out-Null
        }
    }
}

function Normalize-CornerMarksInHeaderFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TempRoot
    )

    $headerPath = Join-Path $TempRoot "word\header1.xml"
    if (-not (Test-Path $headerPath)) {
        return
    }

    $headerXml = Load-XmlDocument -Path $headerPath
    $headerNs = New-Object System.Xml.XmlNamespaceManager($headerXml.NameTable)
    $headerNs.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
    $headerNs.AddNamespace("v", "urn:schemas-microsoft-com:vml")

    while ($true) {
        $markerRun = $headerXml.SelectSingleNode("//w:r[.//v:rect[@alt='sarsh-corner-mark']]", $headerNs)
        if (-not $markerRun) {
            break
        }
        if ($markerRun.ParentNode) {
            $markerRun.ParentNode.RemoveChild($markerRun) | Out-Null
        } else {
            break
        }
    }

    $paragraph = $headerXml.SelectSingleNode("/w:hdr/w:p[1]", $headerNs)
    if ($paragraph) {
        $leftMarker = New-HeaderCornerMarkerRun -OwnerDocument $headerXml -MarginLeftPt $cornerLeftMarginPt -ZIndex "251659264"
        $rightMarker = New-HeaderCornerMarkerRun -OwnerDocument $headerXml -MarginLeftPt $cornerRightMarginPt -ZIndex "251660288"

        $firstRun = $paragraph.SelectSingleNode("./w:r[1]", $headerNs)
        if ($firstRun) {
            $paragraph.InsertBefore($rightMarker, $firstRun) | Out-Null
            $paragraph.InsertBefore($leftMarker, $firstRun) | Out-Null
        } else {
            $paragraph.AppendChild($rightMarker) | Out-Null
            $paragraph.AppendChild($leftMarker) | Out-Null
        }
    }

    Save-XmlUtf8NoBom -XmlDocument $headerXml -Path $headerPath
}

function Remove-CornerMarksFromDocument {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$DocumentXml,
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlNamespaceManager]$DocumentNs
    )

    while ($true) {
        $markerRun = $DocumentXml.SelectSingleNode("//w:r[.//v:rect[@alt='sarsh-corner-mark' or @alt='sarsh-bottom-corner-mark']]", $DocumentNs)
        if (-not $markerRun) {
            break
        }
        if ($markerRun.ParentNode) {
            $markerRun.ParentNode.RemoveChild($markerRun) | Out-Null
        } else {
            break
        }
    }
}

function New-BottomCornerMarkerRun {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$OwnerDocument,
        [Parameter(Mandatory = $true)]
        [string]$MarginLeftPt
    )

    $fragment = @"
<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w10="urn:schemas-microsoft-com:office:word">
  <w:rPr><w:noProof /></w:rPr>
  <w:pict>
    <v:rect alt="sarsh-bottom-corner-mark" style="position:absolute;left:0;text-align:left;margin-left:${MarginLeftPt}pt;margin-top:38.9pt;width:8pt;height:8pt;z-index:251660288;mso-position-horizontal-relative:text;mso-position-vertical-relative:text" fillcolor="black" stroked="f">
      <w10:wrap anchorx="page" anchory="page" />
    </v:rect>
  </w:pict>
</w:r>
"@

    $fragmentXml = New-Object System.Xml.XmlDocument
    $fragmentXml.LoadXml($fragment)
    return $OwnerDocument.ImportNode($fragmentXml.DocumentElement, $true)
}

function New-HeaderCornerMarkerRun {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$OwnerDocument,
        [Parameter(Mandatory = $true)]
        [string]$MarginLeftPt,
        [Parameter(Mandatory = $true)]
        [string]$ZIndex
    )

    $fragment = @"
<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w10="urn:schemas-microsoft-com:office:word">
  <w:pict>
    <v:rect alt="sarsh-corner-mark" style="position:absolute;left:0;text-align:left;margin-left:${MarginLeftPt}pt;margin-top:${cornerTopPt}pt;width:8pt;height:8pt;z-index:${ZIndex};mso-position-horizontal:absolute;mso-position-horizontal-relative:page;mso-position-vertical:absolute;mso-position-vertical-relative:page" fillcolor="black" stroked="f">
      <w10:wrap anchorx="page" anchory="page" />
      <w10:anchorlock />
    </v:rect>
  </w:pict>
</w:r>
"@

    $fragmentXml = New-Object System.Xml.XmlDocument
    $fragmentXml.LoadXml($fragment)
    return $OwnerDocument.ImportNode($fragmentXml.DocumentElement, $true)
}

function Ensure-BottomCornerMarksInTable {
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$DocumentXml,
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlNamespaceManager]$DocumentNs
    )

    $table = $DocumentXml.SelectSingleNode("//w:tbl[1]", $DocumentNs)
    if (-not $table) {
        return
    }

    $rows = $table.SelectNodes("./w:tr", $DocumentNs)
    if ($rows.Count -eq 0) {
        return
    }

    $lastRow = $rows[$rows.Count - 1]
    $cells = $lastRow.SelectNodes("./w:tc", $DocumentNs)
    if ($cells.Count -lt 2) {
        return
    }

    $targets = @(
        @{ Cell = $cells[0]; MarginLeft = "-3.9" },
        @{ Cell = $cells[$cells.Count - 1]; MarginLeft = "42.6" }
    )

    foreach ($target in $targets) {
        $paragraph = $target.Cell.SelectSingleNode("./w:p[1]", $DocumentNs)
        if (-not $paragraph) {
            continue
        }

        $markerRun = New-BottomCornerMarkerRun -OwnerDocument $DocumentXml -MarginLeftPt $target.MarginLeft
        $paragraph.AppendChild($markerRun) | Out-Null
    }
}

function Update-DocxGrid {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DocxPath,
        [Parameter(Mandatory = $true)]
        [int[]]$Widths,
        [string]$ReferenceTableOuterXml = ""
    )

    $tempRoot = Join-Path $env:TEMP ("sarsh-blank-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $env:TEMP ("sarsh-blank-" + [Guid]::NewGuid().ToString("N") + ".zip")

    try {
        New-Item -ItemType Directory -Path $tempRoot | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($DocxPath, $tempRoot)
        Ensure-WordProofingSettings -TempRoot $tempRoot
        Normalize-CornerMarksInHeaderFile -TempRoot $tempRoot

        $xmlPath = Join-Path $tempRoot "word\document.xml"
        $xml = Load-XmlDocument -Path $xmlPath
        $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
        $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
        $ns.AddNamespace("v", "urn:schemas-microsoft-com:vml")

        Remove-CornerMarksFromDocument -DocumentXml $xml -DocumentNs $ns

        $textNodes = $xml.SelectNodes("//w:t", $ns)
        foreach ($textNode in $textNodes) {
            $fixedText = Repair-MojibakeText -Value $textNode.InnerText
            if ($fixedText -ne $textNode.InnerText) {
                $textNode.InnerText = $fixedText
            }
        }

        $table = $xml.SelectSingleNode("//w:tbl[1]", $ns)
        if (-not $table) {
            Write-Output "skip (no table) $DocxPath"
            return
        }

        $gridCols = $table.SelectNodes("./w:tblGrid/w:gridCol", $ns)
        if ($ReferenceTableOuterXml) {
            $referenceXml = New-Object System.Xml.XmlDocument
            $referenceXml.LoadXml($ReferenceTableOuterXml)
            $importedTable = $xml.ImportNode($referenceXml.DocumentElement, $true)
            $table.ParentNode.ReplaceChild($importedTable, $table) | Out-Null
            $table = $xml.SelectSingleNode("//w:tbl[1]", $ns)
            $gridCols = $table.SelectNodes("./w:tblGrid/w:gridCol", $ns)
        }

        if ($gridCols.Count -ne $Widths.Count) {
            Write-Output "skip (unexpected grid count $($gridCols.Count)) $DocxPath"
            return
        }

        for ($i = 0; $i -lt $gridCols.Count; $i++) {
            $gridCols[$i].Attributes["w:w"].Value = [string]$Widths[$i]
        }

        $rows = $table.SelectNodes("./w:tr", $ns)
        foreach ($row in $rows) {
            $colIndex = 0
            $cells = $row.SelectNodes("./w:tc", $ns)
            foreach ($cell in $cells) {
                $gridSpanNode = $cell.SelectSingleNode("./w:tcPr/w:gridSpan", $ns)
                $span = if ($gridSpanNode -and $gridSpanNode.Attributes["w:val"]) {
                    [int]$gridSpanNode.Attributes["w:val"].Value
                } else {
                    1
                }

                $sum = 0
                for ($j = 0; $j -lt $span -and ($colIndex + $j) -lt $Widths.Count; $j++) {
                    $sum += $Widths[$colIndex + $j]
                }

                $tcW = $cell.SelectSingleNode("./w:tcPr/w:tcW", $ns)
                if ($tcW -and $tcW.Attributes["w:w"]) {
                    $tcW.Attributes["w:w"].Value = [string]$sum
                    if ($tcW.Attributes["w:type"]) {
                        $tcW.Attributes["w:type"].Value = "dxa"
                    }
                }

                $colIndex += $span
            }
        }

        Remove-CornerMarksFromDocument -DocumentXml $xml -DocumentNs $ns
        Ensure-BottomCornerMarksInTable -DocumentXml $xml -DocumentNs $ns

        Save-XmlUtf8NoBom -XmlDocument $xml -Path $xmlPath

        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $zipPath)
        Copy-Item $zipPath $DocxPath -Force

        Write-Output "updated docx $DocxPath"
    } finally {
        if (Test-Path $tempRoot) {
            Remove-Item $tempRoot -Recurse -Force
        }
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
    }
}

function Get-ReferenceTableOuterXml {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$DocxPaths,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedGridCount
    )

    foreach ($docxPath in $DocxPaths) {
        $tempRoot = Join-Path $env:TEMP ("sarsh-ref-" + [Guid]::NewGuid().ToString("N"))
        try {
            New-Item -ItemType Directory -Path $tempRoot | Out-Null
            [System.IO.Compression.ZipFile]::ExtractToDirectory($docxPath, $tempRoot)

            $xmlPath = Join-Path $tempRoot "word\document.xml"
            $xml = New-Object System.Xml.XmlDocument
            $xml.PreserveWhitespace = $true
            $xml.Load($xmlPath)
            $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
            $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

            $table = $xml.SelectSingleNode("//w:tbl[1]", $ns)
            if (-not $table) {
                continue
            }

            $gridCols = $table.SelectNodes("./w:tblGrid/w:gridCol", $ns)
            if ($gridCols.Count -eq $ExpectedGridCount) {
                return $table.OuterXml
            }
        } catch {
            continue
        } finally {
            if (Test-Path $tempRoot) {
                Remove-Item $tempRoot -Recurse -Force
            }
        }
    }

    return ""
}

function Get-PreferredReferenceDocxPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DepartmentsRoot,
        [Parameter(Mandatory = $true)]
        [string[]]$AllDocxPaths
    )

    return @($AllDocxPaths)
}

function Refresh-PdfFromDocx {
    param(
        [Parameter(Mandatory = $true)]
        $Word,
        [Parameter(Mandatory = $true)]
        [string]$DocxPath
    )

    $doc = $null
    try {
        $doc = $Word.Documents.Open($DocxPath, $false, $false)
        $doc.Save()
        $pdfPath = [System.IO.Path]::ChangeExtension($DocxPath, ".pdf")
        $doc.ExportAsFixedFormat($pdfPath, $wordPdfFormat)
        Write-Output "updated pdf $pdfPath"
    } finally {
        if ($doc) {
            try {
                $doc.Close([ref]0)
            } catch {
            }
        }
    }
}

function Get-DepartmentsRoots {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    $candidates = Get-ChildItem -Path $RootPath -Directory | ForEach-Object {
        $docxCount = (Get-ChildItem -Path $_.FullName -Recurse -File -Filter *.docx -ErrorAction SilentlyContinue | Measure-Object).Count
        [pscustomobject]@{
            FullName  = $_.FullName
            DocxCount = $docxCount
        }
    } | Where-Object { $_.DocxCount -gt 0 } | Sort-Object FullName

    if (-not $candidates) {
        throw "Could not locate any department blanks directories."
    }

    return $candidates.FullName
}

$departmentsRoots = Get-DepartmentsRoots -RootPath $projectRoot
$lockedFiles = New-Object System.Collections.Generic.List[string]

foreach ($departmentsRoot in $departmentsRoots) {
    $docxFiles = Get-ChildItem -Path $departmentsRoot -Recurse -File | Where-Object {
        $_.Extension -eq ".docx"
    } | Sort-Object FullName

    if (-not $docxFiles) {
        continue
    }

    $referenceCandidates = Get-PreferredReferenceDocxPaths -DepartmentsRoot $departmentsRoot -AllDocxPaths $docxFiles.FullName
    $referenceTableOuterXml = Get-ReferenceTableOuterXml -DocxPaths $referenceCandidates -ExpectedGridCount $targetGridWidths.Count

    foreach ($file in $docxFiles) {
        try {
            Update-DocxGrid -DocxPath $file.FullName -Widths $targetGridWidths -ReferenceTableOuterXml $referenceTableOuterXml
        } catch {
            $lockedFiles.Add($file.FullName) | Out-Null
            Write-Warning "skip locked or busy file $($file.FullName)"
        }
    }

    $word = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0

        foreach ($file in $docxFiles) {
            if ($lockedFiles.Contains($file.FullName)) {
                continue
            }
            try {
                Refresh-PdfFromDocx -Word $word -DocxPath $file.FullName
            } catch {
                Write-Warning "skip pdf refresh for $($file.FullName)"
            }
        }
    } finally {
        if ($word) {
            try {
                $word.Quit()
            } catch {
            }
        }
    }
}

if ($lockedFiles.Count -gt 0) {
    Write-Output ""
    Write-Output "busy files:"
    foreach ($locked in $lockedFiles) {
        Write-Output $locked
    }
}
