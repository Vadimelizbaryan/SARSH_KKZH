using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace MAINFLOW.Desktop;

internal sealed class DesktopDataMirrorService
{
    private const string MirrorScript = """
        (async () => {
          const api = window.SHARSH_APP_API;
          if (!api || (typeof api.ensureDesktopMirrorPayloadData !== "function" && typeof api.getDesktopMirrorPayload !== "function")) {
            return { ok: false, error: "desktop-app-api-unavailable", generatedAtUtc: new Date().toISOString() };
          }

          try {
            const payload = typeof api.ensureDesktopMirrorPayloadData === "function"
              ? await api.ensureDesktopMirrorPayloadData()
              : api.getDesktopMirrorPayload();
            return {
              ok: true,
              generatedAtUtc: new Date().toISOString(),
              payload
            };
          } catch (error) {
            return {
              ok: false,
              generatedAtUtc: new Date().toISOString(),
              error: String(error && error.message ? error.message : error)
            };
          }
        })()
        """;

    private readonly string _mirrorRoot;
    private readonly string _snapshotRoot;
    private readonly string _ocrRoot;
    private readonly string _telegramRoot;
    private readonly string _androidRoot;
    private readonly string _statusPath;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public DesktopDataMirrorService(string mirrorRoot)
    {
        _mirrorRoot = mirrorRoot;
        _snapshotRoot = Path.Combine(_mirrorRoot, "snapshot");
        _ocrRoot = Path.Combine(_mirrorRoot, "ocr-feedback");
        _telegramRoot = Path.Combine(_mirrorRoot, "telegram-forms");
        _androidRoot = Path.Combine(_mirrorRoot, "android-mainform");
        _statusPath = Path.Combine(_mirrorRoot, "mirror-status.json");

        Directory.CreateDirectory(_mirrorRoot);
        Directory.CreateDirectory(_snapshotRoot);
        Directory.CreateDirectory(_ocrRoot);
        Directory.CreateDirectory(_telegramRoot);
        Directory.CreateDirectory(_androidRoot);
    }

    public string MirrorRoot => _mirrorRoot;

    public async Task<DesktopDataMirrorResult> SyncAsync(CoreWebView2 webView)
    {
        var generatedAtUtc = DateTimeOffset.UtcNow;
        try
        {
            var payload = await EvaluateMirrorPayloadAsync(webView);
            if (payload is null)
            {
                var failed = DesktopDataMirrorResult.Failure(
                    generatedAtUtc,
                    "desktop-mirror-payload-invalid"
                );
                await WriteStatusAsync(failed);
                return failed;
            }

            generatedAtUtc = ParseDateTimeOffset(payload.GeneratedAtUtc) ?? generatedAtUtc;
            if (!payload.Ok)
            {
                var failed = DesktopDataMirrorResult.Failure(
                    generatedAtUtc,
                    string.IsNullOrWhiteSpace(payload.Error) ? "desktop-mirror-sync-failed" : payload.Error
                );
                await WriteStatusAsync(failed);
                return failed;
            }

            await WriteSnapshotAsync(payload.SnapshotResult, generatedAtUtc);
            var ocrCount = await WriteRecordCollectionAsync(_ocrRoot, payload.OcrRecords, "ocr-feedback");
            var telegramCount = await WriteRecordCollectionAsync(_telegramRoot, payload.TelegramRecords, "telegram-form");
            var androidCount = await WriteRecordCollectionAsync(_androidRoot, payload.AndroidRecords, "android-mainform");

            var succeeded = DesktopDataMirrorResult.Success(
                generatedAtUtc,
                ocrCount,
                telegramCount,
                androidCount
            );
            await WriteStatusAsync(succeeded);
            return succeeded;
        }
        catch (Exception error)
        {
            var failed = DesktopDataMirrorResult.Failure(generatedAtUtc, error.Message);
            await WriteStatusAsync(failed);
            return failed;
        }
    }

    private async Task WriteSnapshotAsync(JsonElement snapshotResult, DateTimeOffset mirroredAtUtc)
    {
        if (snapshotResult.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return;
        }

        var wrapped = new
        {
            mirroredAtUtc = mirroredAtUtc.ToString("O"),
            payload = snapshotResult
        };
        var latestPath = Path.Combine(_snapshotRoot, "latest.json");
        await WriteJsonFileAsync(latestPath, wrapped);

        var snapshot = TryGetProperty(snapshotResult, "snapshot");
        if (snapshot is null || snapshot.Value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return;
        }

        var reportDate = ReadStringProperty(snapshot.Value, "reportDate");
        if (string.IsNullOrWhiteSpace(reportDate))
        {
            return;
        }

        var historyPath = Path.Combine(_snapshotRoot, $"{SanitizeFileName(reportDate)}.json");
        await WriteJsonFileAsync(historyPath, wrapped);
    }

    private async Task<int> WriteRecordCollectionAsync(string collectionRoot, JsonElement recordsElement, string fallbackPrefix)
    {
        Directory.CreateDirectory(collectionRoot);
        var recordsDir = Path.Combine(collectionRoot, "records");
        var imagesDir = Path.Combine(collectionRoot, "images");
        Directory.CreateDirectory(recordsDir);
        Directory.CreateDirectory(imagesDir);

        var mirroredAtUtc = DateTimeOffset.UtcNow.ToString("O");
        var count = 0;
        var indexPath = Path.Combine(collectionRoot, "index.json");

        if (recordsElement.ValueKind != JsonValueKind.Array)
        {
            await WriteJsonFileAsync(indexPath, new
            {
                mirroredAtUtc,
                count = 0,
                records = Array.Empty<object>()
            });
            await WriteJsonFileAsync(Path.Combine(collectionRoot, "data.json"), new
            {
                mirroredAtUtc,
                count = 0,
                records = Array.Empty<object>()
            });
            return 0;
        }

        var recordSummaries = new List<object>();
        var recordPayloads = new List<JsonElement>();
        var index = 0;
        foreach (var item in recordsElement.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                index += 1;
                continue;
            }

            var recordKey = BuildRecordKey(item, fallbackPrefix, index);
            var recordFileName = $"{recordKey}.json";
            var recordPath = Path.Combine(recordsDir, recordFileName);
            await WriteJsonFileAsync(recordPath, item);
            recordPayloads.Add(item.Clone());

            string? mirroredImageFile = null;
            if (TryGetImageDataUrl(item, out var imageDataUrl) && !string.IsNullOrWhiteSpace(imageDataUrl))
            {
                mirroredImageFile = await WriteImageDataUrlAsync(imagesDir, item, recordKey, imageDataUrl);
            }

            recordSummaries.Add(new
            {
                key = recordKey,
                id = ReadStringProperty(item, "id") ?? ReadStringProperty(item, "feedbackId") ?? "",
                departmentId = ReadStringProperty(item, "department_id") ?? ReadStringProperty(item, "departmentId") ?? "",
                departmentName = ReadStringProperty(item, "department_name") ?? ReadStringProperty(item, "departmentName") ?? "",
                reportDate = ReadStringProperty(item, "report_date") ?? ReadStringProperty(item, "reportDate") ?? "",
                createdAt = ReadStringProperty(item, "created_at") ?? ReadStringProperty(item, "createdAt") ?? "",
                imageName = ReadStringProperty(item, "image_name") ?? ReadStringProperty(item, "imageName") ?? "",
                mirroredRecordFile = Path.Combine("records", recordFileName).Replace('\\', '/'),
                mirroredImageFile = string.IsNullOrWhiteSpace(mirroredImageFile)
                    ? ""
                    : Path.Combine("images", mirroredImageFile).Replace('\\', '/')
            });

            count += 1;
            index += 1;
        }

        await WriteJsonFileAsync(indexPath, new
        {
            mirroredAtUtc,
            count,
            records = recordSummaries
        });
        await WriteJsonFileAsync(Path.Combine(collectionRoot, "data.json"), new
        {
            mirroredAtUtc,
            count,
            records = recordPayloads
        });

        return count;
    }

    private async Task<string> WriteImageDataUrlAsync(string imagesDir, JsonElement item, string recordKey, string imageDataUrl)
    {
        var extension = GetImageExtensionFromDataUrl(imageDataUrl);
        var imageName = ReadStringProperty(item, "image_name") ?? ReadStringProperty(item, "imageName") ?? "";
        var baseName = Path.GetFileNameWithoutExtension(imageName);
        if (string.IsNullOrWhiteSpace(baseName))
        {
            baseName = recordKey;
        }

        var safeBaseName = SanitizeFileName(baseName);
        var fileName = $"{safeBaseName}{extension}";
        var targetPath = Path.Combine(imagesDir, fileName);
        var bytes = DecodeDataUrl(imageDataUrl);
        await File.WriteAllBytesAsync(targetPath, bytes);
        return fileName;
    }

    private async Task WriteStatusAsync(DesktopDataMirrorResult status)
    {
        await WriteJsonFileAsync(_statusPath, new
        {
            ok = status.Ok,
            mirroredAtUtc = status.MirroredAtUtc.ToString("O"),
            error = status.Error ?? "",
            counts = new
            {
                ocrFeedback = status.OcrFeedbackCount,
                telegramForms = status.TelegramFormCount,
                androidMainform = status.AndroidMainformCount
            },
            folders = new
            {
                mirrorRoot = _mirrorRoot,
                snapshot = _snapshotRoot,
                ocrFeedback = _ocrRoot,
                telegramForms = _telegramRoot,
                androidMainform = _androidRoot
            }
        });
    }

    private async Task WriteJsonFileAsync(string path, object payload)
    {
        var json = JsonSerializer.Serialize(payload, _jsonOptions);
        await File.WriteAllTextAsync(path, json, Encoding.UTF8);
    }

    private async Task<DesktopMirrorPayload?> EvaluateMirrorPayloadAsync(CoreWebView2 webView)
    {
        var parameters = JsonSerializer.Serialize(new
        {
            expression = MirrorScript,
            awaitPromise = true,
            returnByValue = true
        });
        var rawResponse = await webView.CallDevToolsProtocolMethodAsync("Runtime.evaluate", parameters);
        if (string.IsNullOrWhiteSpace(rawResponse))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(rawResponse);
            if (!document.RootElement.TryGetProperty("result", out var resultElement))
            {
                return null;
            }

            if (!resultElement.TryGetProperty("value", out var valueElement))
            {
                return null;
            }

            var rootPayload = JsonSerializer.Deserialize<DesktopMirrorPayload>(valueElement.GetRawText(), new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            return rootPayload?.Payload is null
                ? rootPayload
                : rootPayload.Payload with
                {
                    Ok = rootPayload.Ok,
                    Error = rootPayload.Error,
                    GeneratedAtUtc = rootPayload.GeneratedAtUtc
                };
        }
        catch
        {
            return null;
        }
    }

    private static string BuildRecordKey(JsonElement item, string fallbackPrefix, int index)
    {
        var rawId = ReadStringProperty(item, "id")
            ?? ReadStringProperty(item, "feedbackId")
            ?? ReadStringProperty(item, "image_name")
            ?? ReadStringProperty(item, "imageName");
        if (!string.IsNullOrWhiteSpace(rawId))
        {
            return SanitizeFileName(rawId);
        }

        var createdAt = ReadStringProperty(item, "created_at") ?? ReadStringProperty(item, "createdAt");
        if (!string.IsNullOrWhiteSpace(createdAt))
        {
            return $"{fallbackPrefix}-{SanitizeFileName(createdAt)}";
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(item.GetRawText()));
        return $"{fallbackPrefix}-{Convert.ToHexString(hash[..8]).ToLowerInvariant()}-{index:D4}";
    }

    private static string? ReadStringProperty(JsonElement element, string propertyName)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (!string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return property.Value.ValueKind == JsonValueKind.String
                ? property.Value.GetString()?.Trim()
                : property.Value.ToString()?.Trim();
        }

        return null;
    }

    private static JsonElement? TryGetProperty(JsonElement element, string propertyName)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                return property.Value;
            }
        }

        return null;
    }

    private static bool TryGetImageDataUrl(JsonElement element, out string? imageDataUrl)
    {
        imageDataUrl = ReadStringProperty(element, "image_data_url") ?? ReadStringProperty(element, "imageDataUrl");
        return !string.IsNullOrWhiteSpace(imageDataUrl) && imageDataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase);
    }

    private static byte[] DecodeDataUrl(string dataUrl)
    {
        var commaIndex = dataUrl.IndexOf(',');
        var base64 = commaIndex >= 0 ? dataUrl[(commaIndex + 1)..] : dataUrl;
        return Convert.FromBase64String(base64);
    }

    private static string GetImageExtensionFromDataUrl(string dataUrl)
    {
        var semicolonIndex = dataUrl.IndexOf(';');
        var header = semicolonIndex >= 0 ? dataUrl[..semicolonIndex] : dataUrl;
        return header.ToLowerInvariant() switch
        {
            var value when value.Contains("image/png", StringComparison.Ordinal) => ".png",
            var value when value.Contains("image/webp", StringComparison.Ordinal) => ".webp",
            _ => ".jpg"
        };
    }

    private static string SanitizeFileName(string value)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var builder = new StringBuilder(value.Length);
        foreach (var character in value.Trim())
        {
            builder.Append(invalidChars.Contains(character) ? '_' : character);
        }

        var normalized = builder.ToString().Trim().Replace(' ', '_');
        return string.IsNullOrWhiteSpace(normalized) ? "record" : normalized;
    }

    private static DateTimeOffset? ParseDateTimeOffset(string? value)
    {
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : null;
    }

    private sealed record DesktopMirrorPayload
    {
        public bool Ok { get; init; }
        public string? GeneratedAtUtc { get; init; }
        public string? Error { get; init; }
        public JsonElement SnapshotResult { get; init; }
        public JsonElement OcrRecords { get; init; }
        public JsonElement TelegramRecords { get; init; }
        public JsonElement AndroidRecords { get; init; }
        public DesktopMirrorPayload? Payload { get; init; }
    }
}

internal sealed record DesktopDataMirrorResult(
    bool Ok,
    DateTimeOffset MirroredAtUtc,
    int OcrFeedbackCount,
    int TelegramFormCount,
    int AndroidMainformCount,
    string? Error
)
{
    public static DesktopDataMirrorResult Success(
        DateTimeOffset mirroredAtUtc,
        int ocrFeedbackCount,
        int telegramFormCount,
        int androidMainformCount
    ) => new(
        true,
        mirroredAtUtc,
        ocrFeedbackCount,
        telegramFormCount,
        androidMainformCount,
        null
    );

    public static DesktopDataMirrorResult Failure(DateTimeOffset mirroredAtUtc, string error) => new(
        false,
        mirroredAtUtc,
        0,
        0,
        0,
        error
    );
}
