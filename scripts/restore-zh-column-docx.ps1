$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$zhHeader = ([char]0x0536) + '/' + ([char]0x0540)

function Get-CleanCellText {
    param(
        [Parameter(Mandatory = $true)]
        $Cell
    )

    return ($Cell.Range.Text -replace '[\r\a]', '').Trim()
}

function Get-DepartmentsRoots {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    return Get-ChildItem $RootPath -Directory -Recurse | Where-Object {
        $_.Name -like '*деления*'
    } | Select-Object -ExpandProperty FullName
}

function Update-DocxBlank {
    param(
        [Parameter(Mandatory = $true)]
        $Word,
        [Parameter(Mandatory = $true)]
        [string]$DocxPath
    )

    $doc = $null
    try {
        $doc = $Word.Documents.Open($DocxPath, $false, $false)
        if ($doc.Tables.Count -lt 1) {
            Write-Output "skip (no table) $DocxPath"
            return
        }

        $table = $doc.Tables.Item(1)
        if ($table.Rows.Count -lt 4 -or $table.Columns.Count -lt 21) {
            Write-Output "skip (unexpected shape) $DocxPath"
            $doc.Close([ref]0)
            return
        }

        $headerText = ''
        try {
            $headerText = Get-CleanCellText -Cell $table.Cell(2, 7)
        } catch {
            $headerText = ''
        }

        if ($table.Columns.Count -eq 21 -and $headerText) {
            $existingHeader = $headerText
            $table.Cell(2, 7).Split(1, 2)
            $table.Cell(2, 7).Range.Text = $zhHeader
            $table.Cell(2, 8).Range.Text = $existingHeader
            $table.Cell(4, 16).Split(1, 2)
            $doc.Save()
            Write-Output "patched $DocxPath"
        } elseif ($table.Columns.Count -ge 22) {
            try {
                $maybeZh = Get-CleanCellText -Cell $table.Cell(2, 7)
                if ($maybeZh -eq $zhHeader) {
                    Write-Output "already patched $DocxPath"
                } else {
                    Write-Output "skip (22 cols, review) $DocxPath"
                }
            } catch {
                Write-Output "skip (22 cols, unreadable) $DocxPath"
            }
        } else {
            Write-Output "skip (unexpected columns) $DocxPath"
        }

        $pdfPath = [System.IO.Path]::ChangeExtension($DocxPath, '.pdf')
        if (Test-Path $pdfPath) {
            $wdExportFormatPDF = 17
            $doc.ExportAsFixedFormat($pdfPath, $wdExportFormatPDF)
            Write-Output "pdf refreshed $pdfPath"
        }

        $doc.Close([ref]0)
    } catch {
        if ($doc) {
            try {
                $doc.Close([ref]0)
            } catch {
            }
        }
        throw
    }
}

$docxFiles = @()
$rootDocxFiles = Get-ChildItem $projectRoot -Filter '*.docx' -File | Where-Object {
    $_.BaseName -ne 'title_par_test' -and (Test-Path ([System.IO.Path]::ChangeExtension($_.FullName, '.pdf')))
}
$docxFiles += $rootDocxFiles.FullName

$departmentsRoots = Get-DepartmentsRoots -RootPath $projectRoot
foreach ($departmentsRoot in $departmentsRoots) {
    $docxFiles += (Get-ChildItem $departmentsRoot -Recurse -Filter '*.docx' -File).FullName
}

$docxFiles = $docxFiles | Sort-Object -Unique

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    foreach ($docxPath in $docxFiles) {
        Update-DocxBlank -Word $word -DocxPath $docxPath
    }
} finally {
    if ($word) {
        try {
            $word.Quit()
        } catch {
        }
    }
}
