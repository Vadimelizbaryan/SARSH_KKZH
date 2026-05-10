$ErrorActionPreference = 'Stop'

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Update-TextFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Transform
    )

    $content = [System.IO.File]::ReadAllText($Path)
    $updated = & $Transform $content
    if ($updated -ne $content) {
        Write-Utf8NoBom -Path $Path -Content $updated
        Write-Output "updated $Path"
    } else {
        Write-Output "nochange $Path"
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot

$appFieldBlock = @'
{ cell: 13, key: "currentShar", label: "13" },
    { cell: 14, key: "currentSpa", label: "14" },
    { cell: 15, key: "currentPaym", label: "15" },
    { cell: 16, key: "currentZh", label: "16" },
    { cell: 17, key: "family", label: "17" },
    { cell: 18, key: "officer", label: "18" },
    { cell: 19, key: "civil", label: "19" },
    { cell: 20, key: "leaveSharq", label: "20" },
    { cell: 21, key: "leaveSpa", label: "21" },
    { cell: 22, key: "leavePaym", label: "22" }
'@

$syncFieldBlock = @'
{ cell: 13, key: "currentShar", label: "Առկա է / շարք" },
  { cell: 14, key: "currentSpa", label: "Առկա է / սպա" },
  { cell: 15, key: "currentPaym", label: "Առկա է / պայման" },
  { cell: 16, key: "currentZh", label: "Առկա է / Զ/Հ" },
  { cell: 17, key: "family", label: "Առկա է / Զ/Ծ ընտ" },
  { cell: 18, key: "officer", label: "Առկա է / Զ/Պ" },
  { cell: 19, key: "civil", label: "Առկա է / Ք-ի" },
  { cell: 20, key: "leaveSharq", label: "Արձակուրդ / շարք" },
  { cell: 21, key: "leaveSpa", label: "Արձակուրդ / սպա" },
  { cell: 22, key: "leavePaym", label: "Արձակուրդ / պայման" }
'@

$appMappingPattern = '\{ cell: 13, key: "currentShar", label: "13" \},\r?\n\s*\{ cell: 14, key: "currentSpa", label: "14" \},\r?\n\s*\{ cell: 15, key: "currentPaym", label: "15" \},\r?\n\s*\{ cell: 16, key: "family", label: "16" \},\r?\n\s*\{ cell: 17, key: "officer", label: "17" \},\r?\n\s*\{ cell: 18, key: "civil", label: "18" \},\r?\n\s*\{ cell: 19, key: "leaveSharq", label: "19" \},\r?\n\s*\{ cell: 20, key: "leaveSpa", label: "20" \},\r?\n\s*\{ cell: 21, key: "leavePaym", label: "21" \}'

$syncMappingPattern = '\{ cell: 13, key: "currentShar", label: ".*?" \},\r?\n\s*\{ cell: 14, key: "currentSpa", label: ".*?" \},\r?\n\s*\{ cell: 15, key: "currentPaym", label: ".*?" \},\r?\n\s*\{ cell: 16, key: "family", label: ".*?" \},\r?\n\s*\{ cell: 17, key: "officer", label: ".*?" \},\r?\n\s*\{ cell: 18, key: "civil", label: ".*?" \},\r?\n\s*\{ cell: 19, key: "leaveSharq", label: ".*?" \},\r?\n\s*\{ cell: 20, key: "leaveSpa", label: ".*?" \},\r?\n\s*\{ cell: 21, key: "leavePaym", label: ".*?" \}'

$insertZhHeaderApp = {
    param($content)

    [regex]::Replace(
        $content,
        '(<th colspan="3" class="hdr-peach">.*?</th>\r?\n)(\s*<th rowspan="2" class="hdr-peach">)',
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($match)
            $match.Groups[1].Value + '          <th rowspan="2" class="hdr-peach">Զ/Հ</th>' + "`r`n" + $match.Groups[2].Value
        },
        1
    )
}

$insertZhHeaderBlank = {
    param($content)

    [regex]::Replace(
        $content,
        '(<th colspan="3" class="hdr-peach">.*?</th>\r?\n)(\s*<th rowspan="2" class="hdr-peach">)',
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($match)
            $match.Groups[1].Value + '            <th rowspan="2" class="hdr-peach">Զ/Հ</th>' + "`r`n" + $match.Groups[2].Value
        },
        1
    )
}

$appPaths = @(
    (Join-Path $projectRoot 'assets\sharsh-app.js'),
    (Join-Path $projectRoot 'SARSH-KKZH-Offline\assets\sharsh-app.js')
)

foreach ($path in $appPaths) {
    Update-TextFile -Path $path -Transform {
        param($content)

        $content = $content.Replace('13-21', '13-22')
        $content = [regex]::Replace(
            $content,
            $appMappingPattern,
            [System.Text.RegularExpressions.MatchEvaluator]{
                param($match)
                $appFieldBlock
            }
        )
        $content = $content.Replace('colspan="7" class="hdr-peach major-left"', 'colspan="8" class="hdr-peach major-left"')
        $content = & $insertZhHeaderApp $content

        return $content
    }
}

Update-TextFile -Path (Join-Path $projectRoot 'SARSH-KKZH-Offline\assets\sharsh-offline-ocr.js') -Transform {
    param($content)

    $content = [regex]::Replace(
        $content,
        $appMappingPattern,
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($match)
            $appFieldBlock
        }
    )

    return $content
}

Update-TextFile -Path (Join-Path $projectRoot 'supabase\functions\sharsh-sync\index.ts') -Transform {
    param($content)

    $content = $content.Replace("`"currentPaym`",`r`n  `"family`"", "`"currentPaym`",`r`n  `"currentZh`",`r`n  `"family`"")
    $content = [regex]::Replace(
        $content,
        $syncMappingPattern,
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($match)
            $syncFieldBlock
        }
    )

    return $content
}

$blankPaths = @(
    (Join-Path $projectRoot 'program-table-blank.html'),
    (Join-Path $projectRoot 'SARSH-KKZH-Offline\program-table-blank.html')
)

foreach ($path in $blankPaths) {
    Update-TextFile -Path $path -Transform {
        param($content)

        $content = [regex]::Replace(
            $content,
            '(\s*<col class="wide-col">)',
            [System.Text.RegularExpressions.MatchEvaluator]{
                param($match)
                '          <col class="num-col">' + "`r`n" + $match.Groups[1].Value
            },
            1
        )
        $content = $content.Replace('colspan="7" class="hdr-peach major-left"', 'colspan="8" class="hdr-peach major-left"')
        $content = & $insertZhHeaderBlank $content
        $content = [regex]::Replace(
            $content,
            '(<td class="data-cell calc-cell major-left"><span></span></td>\r?\n(?:\s*<td class="data-cell"><span></span></td>\r?\n){5})(\s*<td class="data-cell major-left"><span></span></td>)',
            [System.Text.RegularExpressions.MatchEvaluator]{
                param($match)
                $match.Groups[1].Value +
                '            <td class="data-cell"><span></span></td>' + "`r`n" +
                '            <td class="data-cell"><span></span></td>' + "`r`n" +
                $match.Groups[2].Value
            }
        )

        return $content
    }
}

$altBlank = Get-ChildItem $projectRoot -Filter '*.html' | Where-Object {
    $_.Name -ne 'program-table-blank.html' -and $_.Name -like '*бլանկ*'
} | Select-Object -First 1
if ($altBlank) {
    [System.IO.File]::Copy(
        (Join-Path $projectRoot 'program-table-blank.html'),
        $altBlank.FullName,
        $true
    )
    Write-Output "synced $($altBlank.FullName)"
}
