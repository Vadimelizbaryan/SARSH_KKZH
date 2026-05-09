$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetGridWidths = @(
    717, 717, 717, 717, 717, 717, 717, 717, 717, 717, 717,
    717, 717, 717, 717, 717, 717, 717, 717, 717, 717, 717
)
$wordPdfFormat = 17

Add-Type -AssemblyName System.IO.Compression.FileSystem

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

        $xmlPath = Join-Path $tempRoot "word\document.xml"
        [xml]$xml = Get-Content $xmlPath
        $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
        $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

        $table = $xml.SelectSingleNode("//w:tbl[1]", $ns)
        if (-not $table) {
            Write-Output "skip (no table) $DocxPath"
            return
        }

        $gridCols = $table.SelectNodes("./w:tblGrid/w:gridCol", $ns)
        if ($gridCols.Count -ne $Widths.Count) {
            if (-not $ReferenceTableOuterXml) {
                Write-Output "skip (unexpected grid count $($gridCols.Count)) $DocxPath"
                return
            }

            $referenceXml = New-Object System.Xml.XmlDocument
            $referenceXml.LoadXml($ReferenceTableOuterXml)
            $importedTable = $xml.ImportNode($referenceXml.DocumentElement, $true)
            $table.ParentNode.ReplaceChild($importedTable, $table) | Out-Null
            $table = $xml.SelectSingleNode("//w:tbl[1]", $ns)
            $gridCols = $table.SelectNodes("./w:tblGrid/w:gridCol", $ns)

            if ($gridCols.Count -ne $Widths.Count) {
                Write-Output "skip (reference table did not normalize grid) $DocxPath"
                return
            }
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

        $xml.Save($xmlPath)

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
            [xml]$xml = Get-Content $xmlPath
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
        } finally {
            if (Test-Path $tempRoot) {
                Remove-Item $tempRoot -Recurse -Force
            }
        }
    }

    return ""
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

foreach ($departmentsRoot in $departmentsRoots) {
    $docxFiles = Get-ChildItem -Path $departmentsRoot -Recurse -File | Where-Object {
        $_.Extension -eq ".docx"
    } | Sort-Object FullName

    if (-not $docxFiles) {
        continue
    }

    $referenceTableOuterXml = Get-ReferenceTableOuterXml -DocxPaths $docxFiles.FullName -ExpectedGridCount $targetGridWidths.Count

    foreach ($file in $docxFiles) {
        Update-DocxGrid -DocxPath $file.FullName -Widths $targetGridWidths -ReferenceTableOuterXml $referenceTableOuterXml
    }

    $word = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0

        foreach ($file in $docxFiles) {
            Refresh-PdfFromDocx -Word $word -DocxPath $file.FullName
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
