using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: PdfMergeTool <output.pdf> <input1.pdf> <input2.pdf> [...]");
    return 1;
}

var outputPath = Path.GetFullPath(args[0]);
var inputPaths = args.Skip(1).Select(Path.GetFullPath).ToArray();

foreach (var inputPath in inputPaths)
{
    if (!File.Exists(inputPath))
    {
        Console.Error.WriteLine($"Input PDF not found: {inputPath}");
        return 2;
    }
}

Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);

using var outputDocument = new PdfDocument();
outputDocument.Info.Title = "Общий бланк отделений";

var mergedPageCount = 0;

foreach (var inputPath in inputPaths)
{
    using var inputDocument = PdfReader.Open(inputPath, PdfDocumentOpenMode.Import);
    for (var pageIndex = 0; pageIndex < inputDocument.PageCount; pageIndex++)
    {
        outputDocument.AddPage(inputDocument.Pages[pageIndex]);
        mergedPageCount++;
    }
}

if (mergedPageCount == 0)
{
    Console.Error.WriteLine("No PDF pages were merged.");
    return 3;
}

outputDocument.Save(outputPath);
Console.WriteLine($"Merged {mergedPageCount} pages into {outputPath}");
return 0;
