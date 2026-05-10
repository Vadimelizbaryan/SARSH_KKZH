$ErrorActionPreference = "Stop"

$orderedDepartmentFolders = @(
    "Վիրաբուժական",
    "Դիմածնոտային վիր",
    "Քիթ-կոկորդ բ-ք",
    "Ակնաբուժական",
    "Վնասվածքաբանական",
    "Կրծքային մ-բ",
    "Ուռոլոգիական",
    "Նեյրովիրաբուժական",
    "Թռիչքային",
    "Թերապիա",
    "Վերակենդանացման",
    "Նյարդաբանական",
    "Գինեկոլոգիական",
    "ԱՆՈԹԱՅԻՆ",
    "ԻՆՖ",
    "ԱՏԴ",
    "Ք-Հ"
)

function Get-OrderedDepartmentPdfPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DepartmentsRoot
    )

    $paths = foreach ($folderName in $orderedDepartmentFolders) {
        $folderPath = Join-Path $DepartmentsRoot $folderName
        if (-not (Test-Path $folderPath)) {
            throw "Department folder not found: $folderPath"
        }

        $pdfFiles = Get-ChildItem -Path $folderPath -File -Filter *.pdf | Sort-Object Name
        if ($pdfFiles.Count -ne 1) {
            throw "Expected exactly one PDF in $folderPath, found $($pdfFiles.Count)"
        }

        $pdfFiles[0].FullName
    }

    return ,$paths
}

$baseRoot = Split-Path -Parent $PSScriptRoot
$departmentsRoot = Join-Path $baseRoot "Отделения"
$outputPdf = Join-Path $departmentsRoot "Общий бланк отделений.pdf"
$toolProject = Join-Path $baseRoot "tools\\PdfMergeTool\\PdfMergeTool.csproj"

if (-not (Test-Path $departmentsRoot)) {
    throw "Departments root not found: $departmentsRoot"
}

if (-not (Test-Path $toolProject)) {
    throw "Merge tool project not found: $toolProject"
}

$inputPdfPaths = Get-OrderedDepartmentPdfPaths -DepartmentsRoot $departmentsRoot

$arguments = @(
    "run",
    "--project", $toolProject,
    "--configuration", "Release",
    "--",
    $outputPdf
) + $inputPdfPaths

& dotnet @arguments
if ($LASTEXITCODE -ne 0) {
    throw "PDF merge tool failed with exit code $LASTEXITCODE"
}

Write-Output ("Built combined PDF from {0} department blanks -> {1}" -f $inputPdfPaths.Count, $outputPdf)
