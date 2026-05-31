using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SONO.Desktop;

public partial class MainForm : Form
{
    private const string DefaultRelativePage = "sono-desktop.html";
    private const string FunctionBaseUrl = "https://ywecvlapdlaojpvijaqy.functions.supabase.co/Mainflow-telegram";
    private const string PreferredDataBasePath = @"D:\SHARSH AI Data";
    private const string RemoteDesktopManifestUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/SONO.Desktop/package-manifest.json";
    private const string RemoteDesktopSetupUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/Sono.exe";
    private const int AutoUpdateIntervalMs = 20 * 60 * 1000;

    private readonly string _webRootPath;
    private readonly string _appDataRoot;
    private readonly string _webViewUserDataPath;
    private readonly string _stateFilePath;
    private readonly string _downloadsPath;
    private readonly string _localPackageManifestPath;
    private readonly string _updateCacheDir;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private readonly HttpClient _releaseHttpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(20)
    };
    private readonly System.Windows.Forms.Timer _autoUpdateTimer;

    private DesktopAppState _appState;
    private bool _webViewReady;
    private bool _updateCheckInProgress;
    private bool _updateInstallInProgress;
    private string _pendingUpdateToken = string.Empty;
    private string _lastAnnouncedUpdateToken = string.Empty;

    public MainForm()
    {
        InitializeComponent();

        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
        Text = "SONO Desktop";

        _webRootPath = AppContext.BaseDirectory;
        _appDataRoot = ResolvePreferredDataRoot("SONO.Desktop");
        _webViewUserDataPath = Path.Combine(_appDataRoot, "WebView2");
        _stateFilePath = Path.Combine(_appDataRoot, "desktop-state.json");
        _downloadsPath = ResolveDownloadsPath();
        _localPackageManifestPath = Path.Combine(_webRootPath, "package-manifest.json");
        _updateCacheDir = Path.Combine(_appDataRoot, "updates");

        Directory.CreateDirectory(_appDataRoot);
        Directory.CreateDirectory(_webViewUserDataPath);
        Directory.CreateDirectory(_downloadsPath);
        Directory.CreateDirectory(_updateCacheDir);

        _appState = LoadAppState();

        toolStripLabelDeviceValue.Text = Environment.MachineName;
        toolStripButtonReload.Click += async (_, _) => await ReloadFormAsync();
        toolStripButtonOpenDownloads.Click += (_, _) => OpenDownloadsFolder();

        _autoUpdateTimer = new System.Windows.Forms.Timer(components)
        {
            Interval = AutoUpdateIntervalMs
        };
        _autoUpdateTimer.Tick += async (_, _) => await CheckForDesktopUpdatesAsync();

        webView.CreationProperties = new CoreWebView2CreationProperties
        {
            UserDataFolder = _webViewUserDataPath
        };

        Shown += async (_, _) =>
        {
            SetStatus("Проверяю обновления SONO...");
            await CheckForDesktopUpdatesAsync(applyImmediatelyIfAvailable: true);
            if (IsDisposed || _updateInstallInProgress)
            {
                return;
            }

            await InitializeWebViewAsync();
            _autoUpdateTimer.Start();
        };
        Disposed += (_, _) =>
        {
            _autoUpdateTimer.Dispose();
            _releaseHttpClient.Dispose();
        };
    }

    private async Task InitializeWebViewAsync()
    {
        if (_webViewReady)
        {
            return;
        }

        try
        {
            SetStatus("Подключаю форму");

            await webView.EnsureCoreWebView2Async();
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildHostConfigScript());

            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = true;
            webView.CoreWebView2.WebMessageReceived += HandleWebMessageReceived;
            webView.NavigationCompleted += (_, args) =>
            {
                SetStatus(args.IsSuccess
                    ? "Форма готова"
                    : "Не удалось открыть форму");
            };

            _webViewReady = true;
            await ReloadFormAsync();
        }
        catch (Exception error)
        {
            SetStatus("Ошибка запуска формы");
            MessageBox.Show(
                this,
                $"Не удалось запустить встроенный браузер WebView2.\n\n{error.Message}",
                "SONO Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private async Task ReloadFormAsync()
    {
        if (!_webViewReady)
        {
            return;
        }

        var pagePath = Path.Combine(_webRootPath, DefaultRelativePage);
        if (!File.Exists(pagePath))
        {
            SetStatus("Локальная форма не найдена");
            MessageBox.Show(
                this,
                $"Не найден локальный файл формы:\n{pagePath}",
                "SONO Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
            return;
        }

        var uri = new UriBuilder(new Uri(pagePath))
        {
            Query = $"v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
        }.Uri;

        SetStatus("Подключаю форму");
        webView.Source = uri;
        await Task.CompletedTask;
    }

    private string BuildHostConfigScript()
    {
        var hostConfigJson = JsonSerializer.Serialize(new
        {
            deviceId = _appState.DeviceId,
            deviceName = Environment.MachineName,
            functionBaseUrl = FunctionBaseUrl
        });

        return "(function(){window.SONO_DESKTOP_HOST=Object.freeze(" + hostConfigJson + ");})();";
    }

    private void HandleWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var document = JsonDocument.Parse(args.WebMessageAsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var root = document.RootElement;
            var type = root.TryGetProperty("type", out var typeElement)
                ? typeElement.GetString() ?? string.Empty
                : string.Empty;

            if (string.Equals(type, "sono-open-downloads", StringComparison.OrdinalIgnoreCase))
            {
                OpenDownloadsFolder();
                return;
            }

            if (!string.Equals(type, "sono-save-file", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var fileName = root.TryGetProperty("fileName", out var fileNameElement)
                ? fileNameElement.GetString()
                : null;
            var mimeType = root.TryGetProperty("mimeType", out var mimeTypeElement)
                ? mimeTypeElement.GetString()
                : null;
            var fileBase64 = root.TryGetProperty("fileBase64", out var fileBase64Element)
                ? fileBase64Element.GetString()
                : null;

            _ = SaveSonoFileAsync(fileName, mimeType, fileBase64);
        }
        catch
        {
        }
    }

    private async Task SaveSonoFileAsync(string? fileName, string? mimeType, string? fileBase64)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(fileBase64))
            {
                throw new InvalidOperationException("Файл Word не был получен от формы SONO.");
            }

            Directory.CreateDirectory(_downloadsPath);

            var safeFileName = SanitizeFileName(fileName, ".docx");
            var targetPath = GetAvailableFilePath(Path.Combine(_downloadsPath, safeFileName));
            var bytes = Convert.FromBase64String(fileBase64);
            await File.WriteAllBytesAsync(targetPath, bytes);

            SetStatus($"Word сохранен: {Path.GetFileName(targetPath)}");
            PostHostMessage(new
            {
                type = "sono-save-complete",
                savedPath = targetPath,
                fileName = Path.GetFileName(targetPath),
                mimeType = string.IsNullOrWhiteSpace(mimeType)
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : mimeType
            });
        }
        catch (Exception error)
        {
            SetStatus("Не удалось сохранить Word");
            PostHostMessage(new
            {
                type = "sono-save-failed",
                error = error.Message
            });
        }
    }

    private void PostHostMessage(object payload)
    {
        if (!_webViewReady || webView.CoreWebView2 is null)
        {
            return;
        }

        var json = JsonSerializer.Serialize(payload, _jsonOptions);
        if (InvokeRequired)
        {
            BeginInvoke(() => webView.CoreWebView2.PostWebMessageAsJson(json));
            return;
        }

        webView.CoreWebView2.PostWebMessageAsJson(json);
    }

    private void OpenDownloadsFolder()
    {
        try
        {
            Directory.CreateDirectory(_downloadsPath);
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"\"{_downloadsPath}\"",
                UseShellExecute = true
            });
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"Не удалось открыть папку Downloads.\n\n{error.Message}",
                "SONO Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private DesktopAppState LoadAppState()
    {
        try
        {
            if (File.Exists(_stateFilePath))
            {
                var json = File.ReadAllText(_stateFilePath);
                var parsed = JsonSerializer.Deserialize<DesktopAppState>(json, _jsonOptions);
                if (parsed is not null && !string.IsNullOrWhiteSpace(parsed.DeviceId))
                {
                    return parsed;
                }
            }
        }
        catch
        {
        }

        var created = new DesktopAppState
        {
            DeviceId = Guid.NewGuid().ToString("N")
        };
        SaveAppState(created);
        return created;
    }

    private void SaveAppState()
    {
        SaveAppState(_appState);
    }

    private void SaveAppState(DesktopAppState state)
    {
        try
        {
            Directory.CreateDirectory(_appDataRoot);
            File.WriteAllText(_stateFilePath, JsonSerializer.Serialize(state, _jsonOptions));
        }
        catch
        {
        }
    }

    private static string ResolveDownloadsPath()
    {
        var downloadsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "Downloads"
        );

        try
        {
            Directory.CreateDirectory(downloadsPath);
            return downloadsPath;
        }
        catch
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        }
    }

    private static string ResolvePreferredDataRoot(string appFolderName)
    {
        try
        {
            if (Directory.Exists(@"D:\"))
            {
                var preferredPath = Path.Combine(PreferredDataBasePath, appFolderName);
                Directory.CreateDirectory(preferredPath);
                return preferredPath;
            }
        }
        catch
        {
        }

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            appFolderName
        );
    }

    private static string SanitizeFileName(string? fileName, string extension)
    {
        var baseName = string.IsNullOrWhiteSpace(fileName)
            ? "Sono"
            : Path.GetFileName(fileName);

        foreach (var invalidChar in Path.GetInvalidFileNameChars())
        {
            baseName = baseName.Replace(invalidChar, '_');
        }

        if (!baseName.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
        {
            baseName = Path.GetFileNameWithoutExtension(baseName);
            if (string.IsNullOrWhiteSpace(baseName))
            {
                baseName = "Sono";
            }
            baseName += extension;
        }

        return baseName;
    }

    private static string GetAvailableFilePath(string desiredPath)
    {
        if (!File.Exists(desiredPath))
        {
            return desiredPath;
        }

        var directory = Path.GetDirectoryName(desiredPath) ?? "";
        var baseName = Path.GetFileNameWithoutExtension(desiredPath);
        var extension = Path.GetExtension(desiredPath);
        for (var index = 2; index < 1000; index += 1)
        {
            var candidate = Path.Combine(directory, $"{baseName} ({index}){extension}");
            if (!File.Exists(candidate))
            {
                return candidate;
            }
        }

        return Path.Combine(
            directory,
            $"{baseName}_{DateTime.Now:yyyyMMdd_HHmmss}{extension}"
        );
    }

    private async Task CheckForDesktopUpdatesAsync(bool applyImmediatelyIfAvailable = false)
    {
        if (_updateCheckInProgress || _updateInstallInProgress)
        {
            return;
        }

        _updateCheckInProgress = true;
        try
        {
            var localManifest = await TryLoadPackageManifestAsync(_localPackageManifestPath);
            var remoteManifest = await DownloadRemotePackageManifestAsync();
            if (remoteManifest is null)
            {
                return;
            }

            var localToken = BuildManifestToken(localManifest);
            var remoteToken = BuildManifestToken(remoteManifest);
            if (string.IsNullOrWhiteSpace(remoteToken)
                || !IsRemoteManifestNewer(localManifest, remoteManifest))
            {
                _pendingUpdateToken = string.Empty;
                return;
            }

            _pendingUpdateToken = remoteToken;

            if (applyImmediatelyIfAvailable || ShouldInstallUpdateWhileRunning())
            {
                await BeginSilentUpdateAsync();
                return;
            }

            if (!string.Equals(_lastAnnouncedUpdateToken, remoteToken, StringComparison.OrdinalIgnoreCase))
            {
                _lastAnnouncedUpdateToken = remoteToken;
                SetStatus("Доступно обновление SONO. Установлю его при следующем запуске или когда окно будет свернуто.");
            }
        }
        catch
        {
        }
        finally
        {
            _updateCheckInProgress = false;
        }
    }

    private bool ShouldInstallUpdateWhileRunning()
    {
        return !Visible || WindowState == FormWindowState.Minimized;
    }

    private async Task BeginSilentUpdateAsync()
    {
        if (_updateInstallInProgress || string.IsNullOrWhiteSpace(_pendingUpdateToken))
        {
            return;
        }

        _updateInstallInProgress = true;
        try
        {
            SetStatus("Обновляю SONO Desktop...");

            var updaterPath = await DownloadUpdaterAsync(_pendingUpdateToken);
            if (string.IsNullOrWhiteSpace(updaterPath) || !File.Exists(updaterPath))
            {
                throw new FileNotFoundException("Не удалось подготовить updater SONO Desktop.");
            }

            SaveAppState();

            var started = Process.Start(new ProcessStartInfo
            {
                FileName = updaterPath,
                WorkingDirectory = Path.GetDirectoryName(updaterPath)!,
                Arguments = "--silent-update --remote",
                UseShellExecute = true
            });

            if (started is null)
            {
                throw new InvalidOperationException("Updater SONO Desktop не был запущен.");
            }

            Close();
        }
        catch
        {
            _updateInstallInProgress = false;
            SetStatus("Не удалось запустить автообновление");
        }
    }

    private async Task<string> DownloadUpdaterAsync(string updateToken)
    {
        Directory.CreateDirectory(_updateCacheDir);

        foreach (var oldFile in Directory.GetFiles(_updateCacheDir, "Sono-updater-*.exe"))
        {
            try
            {
                File.Delete(oldFile);
            }
            catch
            {
            }
        }

        var safeToken = BuildSafeFileToken(updateToken);
        var finalPath = Path.Combine(_updateCacheDir, $"Sono-updater-{safeToken}.exe");
        var tempPath = finalPath + ".download";

        using var response = await _releaseHttpClient.GetAsync(AppendCacheBust(RemoteDesktopSetupUrl), HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        await using (var input = await response.Content.ReadAsStreamAsync())
        await using (var output = File.Create(tempPath))
        {
            await input.CopyToAsync(output);
        }

        if (File.Exists(finalPath))
        {
            File.Delete(finalPath);
        }

        File.Move(tempPath, finalPath);
        return finalPath;
    }

    private async Task<DesktopPackageManifest?> TryLoadPackageManifestAsync(string manifestPath)
    {
        if (!File.Exists(manifestPath))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(manifestPath);
            return JsonSerializer.Deserialize<DesktopPackageManifest>(json, _jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private async Task<DesktopPackageManifest?> DownloadRemotePackageManifestAsync()
    {
        try
        {
            using var response = await _releaseHttpClient.GetAsync(AppendCacheBust(RemoteDesktopManifestUrl), HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync();
            return await JsonSerializer.DeserializeAsync<DesktopPackageManifest>(stream, _jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static string BuildManifestToken(DesktopPackageManifest? manifest)
    {
        if (manifest is null)
        {
            return string.Empty;
        }

        if (!string.IsNullOrWhiteSpace(manifest.GeneratedAtUtc))
        {
            return manifest.GeneratedAtUtc.Trim();
        }

        return $"{manifest.Files.Count}:{string.Join("|", manifest.Files.Take(5).Select(file => $"{file.Path}:{file.Size}:{file.Sha256}"))}";
    }

    private static bool IsRemoteManifestNewer(DesktopPackageManifest? localManifest, DesktopPackageManifest remoteManifest)
    {
        if (localManifest is null)
        {
            return true;
        }

        if (TryParseManifestTimestamp(localManifest, out var localTimestamp)
            && TryParseManifestTimestamp(remoteManifest, out var remoteTimestamp))
        {
            return remoteTimestamp > localTimestamp;
        }

        var localToken = BuildManifestToken(localManifest);
        var remoteToken = BuildManifestToken(remoteManifest);
        return !string.IsNullOrWhiteSpace(remoteToken)
            && !string.Equals(localToken, remoteToken, StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryParseManifestTimestamp(DesktopPackageManifest? manifest, out DateTimeOffset timestamp)
    {
        timestamp = default;
        return manifest is not null
            && !string.IsNullOrWhiteSpace(manifest.GeneratedAtUtc)
            && DateTimeOffset.TryParse(manifest.GeneratedAtUtc, out timestamp);
    }

    private static string BuildSafeFileToken(string token)
    {
        var chars = token.Where(char.IsLetterOrDigit).ToArray();
        if (chars.Length == 0)
        {
            return DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        }

        var sanitized = new string(chars);
        return sanitized.Length <= 32 ? sanitized : sanitized[..32];
    }

    private static string AppendCacheBust(string url)
    {
        var separator = url.Contains('?') ? "&" : "?";
        return $"{url}{separator}v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
    }

    private void SetStatus(string text)
    {
        if (InvokeRequired)
        {
            BeginInvoke(() => SetStatus(text));
            return;
        }

        toolStripStatusLabelValue.Text = text;
    }

    private sealed class DesktopAppState
    {
        public string DeviceId { get; init; } = string.Empty;
    }

    private sealed class DesktopPackageManifest
    {
        public string GeneratedAtUtc { get; init; } = string.Empty;

        public List<DesktopPackageFile> Files { get; init; } = [];
    }

    private sealed class DesktopPackageFile
    {
        public string Path { get; init; } = string.Empty;

        public long Size { get; init; }

        public string Sha256 { get; init; } = string.Empty;
    }
}
