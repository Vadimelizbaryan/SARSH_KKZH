using System.Diagnostics;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace MAINFLOW.Desktop;

public partial class Form1 : Form
{
    private const string DefaultRelativePage = "index.html";
    private const string RemoteSupabaseUrl = "https://ywecvlapdlaojpvijaqy.supabase.co";
    private const string RemoteSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3ZWN2bGFwZGxhb2pwdmlqYXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTAzMjgsImV4cCI6MjA5MzYyNjMyOH0._HEPdPB2bBTo_N-1Qo8jLau5g5oYGgvoGnBWPxDupL4";
    private const string RemoteFunctionName = "sharsh-sync";
    private const string AutoStartRegistryPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string AutoStartRegistryValueName = "MAINFLOW Desktop";
    private const string RemoteDesktopManifestUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/MAINFLOW.Desktop/package-manifest.json";
    private const string RemoteDesktopSetupUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/Mainflow.exe";
    private const int AutoUpdateIntervalMs = 20 * 60 * 1000;
    private const int InitialVisibleUpdateDelayMs = 90 * 1000;
    private const int InitialBackgroundUpdateDelayMs = 15 * 1000;
    private const int VisibleAutoUpdateGraceDelayMs = 10 * 1000;

    private readonly bool _startInBackground;
    private readonly string _webRootPath;
    private readonly string _appDataRoot;
    private readonly string _webViewUserDataPath;
    private readonly string _stateFilePath;
    private readonly string _localPackageManifestPath;
    private readonly string _updateCacheDir;
    private readonly HttpClient _releaseHttpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(20)
    };
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private readonly Dictionary<string, string> _pageTitles = new(StringComparer.OrdinalIgnoreCase)
    {
        [DefaultRelativePage] = "Главная таблица",
        ["setup.html"] = "Настройки",
        ["ocr-feedback.html"] = "OCR журнал"
    };

    private readonly ToolStripButton _toolStripButtonBackground;
    private readonly ToolStripButton _toolStripButtonAutoStart;
    private readonly ContextMenuStrip _trayMenu;
    private readonly NotifyIcon _trayIcon;
    private readonly ToolStripMenuItem _trayMenuOpen;
    private readonly ToolStripMenuItem _trayMenuSync;
    private readonly ToolStripMenuItem _trayMenuAutoStart;
    private readonly ToolStripMenuItem _trayMenuExit;
    private readonly System.Windows.Forms.Timer _autoUpdateTimer;

    private DesktopShellState _shellState;
    private bool _suppressModeEvents;
    private bool _webViewReady;
    private bool _allowClose;
    private bool _trayHintShown;
    private bool _backgroundLaunchHandled;
    private bool _updateCheckInProgress;
    private bool _updateInstallInProgress;
    private string _currentRelativePage = DefaultRelativePage;
    private string _pendingUpdateToken = string.Empty;
    private string _lastAnnouncedUpdateToken = string.Empty;

    public Form1(bool startInBackground = false)
    {
        _startInBackground = startInBackground;
        InitializeComponent();

        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
        Text = "Mainflow Desktop";

        _webRootPath = AppContext.BaseDirectory;
        _appDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MAINFLOW.Desktop"
        );
        _webViewUserDataPath = Path.Combine(_appDataRoot, "WebView2");
        _stateFilePath = Path.Combine(_appDataRoot, "desktop-state.json");
        _localPackageManifestPath = Path.Combine(_webRootPath, "package-manifest.json");
        _updateCacheDir = Path.Combine(_appDataRoot, "updates");

        Directory.CreateDirectory(_appDataRoot);
        Directory.CreateDirectory(_webViewUserDataPath);
        Directory.CreateDirectory(_updateCacheDir);

        _shellState = LoadShellState();
        if (_startInBackground)
        {
            _currentRelativePage = DefaultRelativePage;
            if (HasInternetAvailable())
            {
                _shellState = _shellState with { Mode = DesktopMode.Online };
            }
            WindowState = FormWindowState.Minimized;
            ShowInTaskbar = false;
        }
        else
        {
            _currentRelativePage = NormalizeRelativePage(_shellState.LastRelativePage);
        }

        webView.CreationProperties = new CoreWebView2CreationProperties
        {
            UserDataFolder = _webViewUserDataPath
        };

        _toolStripButtonBackground = new ToolStripButton("В фон")
        {
            DisplayStyle = ToolStripItemDisplayStyle.Text
        };
        _toolStripButtonBackground.Click += (_, _) => HideToTray(
            showBalloon: true,
            title: "Mainflow работает в фоне",
            message: "Приложение свернуто в трей и продолжит синхронизацию, обновления и уведомления."
        );

        _toolStripButtonAutoStart = new ToolStripButton
        {
            DisplayStyle = ToolStripItemDisplayStyle.Text
        };
        _toolStripButtonAutoStart.Click += (_, _) => ToggleAutoStartPreference();

        var syncQueueIndex = topToolStrip.Items.IndexOf(toolStripButtonSyncQueue);
        if (syncQueueIndex >= 0)
        {
            topToolStrip.Items.Insert(syncQueueIndex + 1, _toolStripButtonBackground);
            topToolStrip.Items.Insert(syncQueueIndex + 2, _toolStripButtonAutoStart);
        }
        else
        {
            topToolStrip.Items.Add(_toolStripButtonBackground);
            topToolStrip.Items.Add(_toolStripButtonAutoStart);
        }

        _trayMenu = new ContextMenuStrip(components);
        _trayMenuOpen = new ToolStripMenuItem("Открыть Mainflow");
        _trayMenuOpen.Click += (_, _) => RestoreFromTray();
        _trayMenuSync = new ToolStripMenuItem("Синхронизировать очередь");
        _trayMenuSync.Click += async (_, _) => await HandleSyncQueueAsync();
        _trayMenuAutoStart = new ToolStripMenuItem("Запускать с Windows")
        {
            CheckOnClick = false
        };
        _trayMenuAutoStart.Click += (_, _) => ToggleAutoStartPreference();
        _trayMenuExit = new ToolStripMenuItem("Выход");
        _trayMenuExit.Click += (_, _) => ExitApplication();
        _trayMenu.Items.AddRange([
            _trayMenuOpen,
            _trayMenuSync,
            new ToolStripSeparator(),
            _trayMenuAutoStart,
            new ToolStripSeparator(),
            _trayMenuExit
        ]);

        _trayIcon = new NotifyIcon(components)
        {
            Text = "Mainflow Desktop",
            Visible = true,
            ContextMenuStrip = _trayMenu,
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application
        };
        _trayIcon.DoubleClick += (_, _) => RestoreFromTray();
        _trayIcon.BalloonTipClicked += (_, _) => RestoreFromTray();

        _autoUpdateTimer = new System.Windows.Forms.Timer(components)
        {
            Interval = AutoUpdateIntervalMs
        };
        _autoUpdateTimer.Tick += async (_, _) => await CheckForDesktopUpdatesAsync();

        toolStripComboBoxMode.Items.Clear();
        toolStripComboBoxMode.Items.AddRange(["Оффлайн", "Онлайн"]);

        ApplyAutoStartPreference(silent: true);
        ApplyModeToUi(GetSafeInitialMode());
        UpdateAutoStartUi();
        UpdateBannerText();
        UpdateNetworkStatus();
        UpdateCurrentPageStatus();

        toolStripButtonHome.Click += (_, _) => NavigateToRelativePage(DefaultRelativePage);
        toolStripButtonSetup.Click += (_, _) => NavigateToRelativePage("setup.html");
        toolStripButtonFeedback.Click += (_, _) => NavigateToRelativePage("ocr-feedback.html");
        toolStripButtonReload.Click += (_, _) => ReloadCurrentPage();
        toolStripButtonSyncQueue.Click += async (_, _) => await HandleSyncQueueAsync();
        toolStripButtonOpenDataFolder.Click += (_, _) => OpenDataFolder();
        toolStripComboBoxMode.SelectedIndexChanged += (_, _) => HandleModeChangedFromUi();
        networkTimer.Tick += (_, _) => UpdateNetworkStatus();
        Resize += (_, _) => HandleResizeToTray();
        Disposed += (_, _) =>
        {
            _autoUpdateTimer.Dispose();
            _releaseHttpClient.Dispose();
        };
        Shown += async (_, _) =>
        {
            await InitializeWebViewAsync();
            HandleInitialBackgroundLaunch();
            _autoUpdateTimer.Start();
            FireAndForgetAutoUpdateCheck(_startInBackground ? InitialBackgroundUpdateDelayMs : InitialVisibleUpdateDelayMs);
        };
        FormClosing += HandleFormClosing;
    }

    private void FireAndForgetAutoUpdateCheck(int delayMs)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                if (delayMs > 0)
                {
                    await Task.Delay(delayMs);
                }

                if (IsDisposed)
                {
                    return;
                }

                BeginInvoke(async () => await CheckForDesktopUpdatesAsync());
            }
            catch
            {
            }
        });
    }

    private async Task InitializeWebViewAsync()
    {
        if (_webViewReady)
        {
            return;
        }

        try
        {
            await webView.EnsureCoreWebView2Async();
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = true;
            webView.CoreWebView2.NavigationStarting += (_, args) => HandleModeAwareNavigation(args);
            webView.CoreWebView2.WebMessageReceived += HandleWebMessageReceived;
            webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                if (string.IsNullOrWhiteSpace(args.Uri))
                {
                    return;
                }

                if (TryBuildModeAwareUri(args.Uri, _shellState.Mode, out var redirectUri))
                {
                    webView.CoreWebView2.Navigate(redirectUri.AbsoluteUri);
                    return;
                }

                webView.CoreWebView2.Navigate(args.Uri);
            };
            webView.NavigationCompleted += (_, _) =>
            {
                CaptureCurrentRelativePageFromWebView();
                UpdateCurrentPageStatus();
                SaveShellState();
            };
            _webViewReady = true;
            NavigateToRelativePage(_currentRelativePage, saveState: false);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"Не удалось запустить встроенный браузер WebView2.\n\n{error.Message}",
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private void HandleModeChangedFromUi()
    {
        if (_suppressModeEvents)
        {
            return;
        }

        var requestedMode = GetSelectedMode();
        if (requestedMode == DesktopMode.Online && !HasInternetAvailable())
        {
            MessageBox.Show(
                this,
                "Сейчас нет интернет-связи. Переключение в онлайн-режим отменено.",
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
            ApplyModeToUi(DesktopMode.Offline);
            return;
        }

        _shellState = _shellState with { Mode = requestedMode };
        UpdateBannerText();
        UpdateCurrentPageStatus();
        SaveShellState();
        if (_webViewReady)
        {
            NavigateToRelativePage(_currentRelativePage, saveState: false);
        }

        if (requestedMode == DesktopMode.Online)
        {
            FireAndForgetAutoUpdateCheck(2000);
        }
    }

    private void ReloadCurrentPage()
    {
        if (_webViewReady)
        {
            NavigateToRelativePage(_currentRelativePage, saveState: false);
        }
    }

    private async Task HandleSyncQueueAsync()
    {
        if (!_webViewReady || webView.CoreWebView2 is null)
        {
            return;
        }

        toolStripButtonSyncQueue.Enabled = false;
        _trayMenuSync.Enabled = false;
        try
        {
            var rawResult = await webView.CoreWebView2.ExecuteScriptAsync(
                "window.SHARSH_APP_API?.syncPendingChanges ? window.SHARSH_APP_API.syncPendingChanges() : Promise.resolve({ ok: false, error: 'sync-api-unavailable' });"
            );
            var result = DeserializeScriptResult<PendingSyncCommandResult>(rawResult);
            if (result is null)
            {
                MessageBox.Show(
                    this,
                    "Не удалось прочитать результат синхронизации из страницы Mainflow.",
                    "Mainflow Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            if (result.Ok)
            {
                MessageBox.Show(
                    this,
                    result.SyncedCount > 0
                        ? $"Накопленные изменения синхронизированы.\n\nОтправлено: {result.SyncedCount}\nОсталось в очереди: {result.RemainingCount}"
                        : "Очередь синхронизации уже пуста.",
                    "Mainflow Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            MessageBox.Show(
                this,
                string.IsNullOrWhiteSpace(result.Error)
                    ? "Не удалось синхронизировать накопленные изменения."
                    : result.Error,
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"Не удалось запустить синхронизацию очереди.\n\n{error.Message}",
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
        finally
        {
            toolStripButtonSyncQueue.Enabled = true;
            _trayMenuSync.Enabled = true;
        }
    }

    private async Task CheckForDesktopUpdatesAsync()
    {
        if (_updateCheckInProgress || _updateInstallInProgress)
        {
            return;
        }

        if (!_webViewReady || _shellState.Mode != DesktopMode.Online || !HasInternetAvailable())
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
            if (string.IsNullOrWhiteSpace(remoteToken) || string.Equals(localToken, remoteToken, StringComparison.OrdinalIgnoreCase))
            {
                _pendingUpdateToken = string.Empty;
                return;
            }

            _pendingUpdateToken = remoteToken;

            if (await HasBlockingLocalWorkForUpdateAsync())
            {
                return;
            }

            if (IsHiddenToTrayState())
            {
                await BeginSilentUpdateAsync();
                return;
            }

            if (!string.Equals(_lastAnnouncedUpdateToken, remoteToken, StringComparison.OrdinalIgnoreCase))
            {
                _lastAnnouncedUpdateToken = remoteToken;
                ShowTrayBalloon(
                    "Обновление Mainflow готово",
                    $"Новая версия установится автоматически через {VisibleAutoUpdateGraceDelayMs / 1000} сек. Если появятся несохранённые данные, обновление подождёт."
                );
            }

            await Task.Delay(VisibleAutoUpdateGraceDelayMs);
            if (IsDisposed || !string.Equals(_pendingUpdateToken, remoteToken, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (await HasBlockingLocalWorkForUpdateAsync())
            {
                return;
            }

            await BeginSilentUpdateAsync();
        }
        catch
        {
        }
        finally
        {
            _updateCheckInProgress = false;
        }
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
            var updaterPath = await DownloadUpdaterAsync(_pendingUpdateToken);
            if (string.IsNullOrWhiteSpace(updaterPath) || !File.Exists(updaterPath))
            {
                throw new FileNotFoundException("Не удалось подготовить updater Mainflow.");
            }

            SaveShellState();

            var arguments = "--silent-update --remote";
            if (IsHiddenToTrayState())
            {
                arguments += " --restart-background";
            }

            var started = Process.Start(new ProcessStartInfo
            {
                FileName = updaterPath,
                WorkingDirectory = Path.GetDirectoryName(updaterPath)!,
                Arguments = arguments,
                UseShellExecute = true
            });

            if (started is null)
            {
                throw new InvalidOperationException("Updater Mainflow не был запущен.");
            }

            _allowClose = true;
            _trayIcon.Visible = false;
            Close();
        }
        catch (Exception error)
        {
            _updateInstallInProgress = false;
            ShowTrayBalloon(
                "Обновление Mainflow не запущено",
                LimitBalloonText(error.Message, 240)
            );
        }
    }

    private async Task<string> DownloadUpdaterAsync(string updateToken)
    {
        Directory.CreateDirectory(_updateCacheDir);

        foreach (var oldFile in Directory.GetFiles(_updateCacheDir, "Mainflow-updater-*.exe"))
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
        var finalPath = Path.Combine(_updateCacheDir, $"Mainflow-updater-{safeToken}.exe");
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

    private async Task<bool> HasBlockingLocalWorkForUpdateAsync()
    {
        if (!_webViewReady || webView.CoreWebView2 is null)
        {
            return false;
        }

        try
        {
            var rawResult = await webView.CoreWebView2.ExecuteScriptAsync(
                "window.SHARSH_APP_API?.getDesktopUpdateBlockers ? window.SHARSH_APP_API.getDesktopUpdateBlockers() : (window.SHARSH_APP_API?.getPendingSyncStatus ? window.SHARSH_APP_API.getPendingSyncStatus() : null)"
            );
            var blockers = DeserializeScriptResult<DesktopUpdateBlockersResult>(rawResult);
            if (blockers is not null)
            {
                return blockers.HasBlockingWork
                    || blockers.HasBlockingUiWork
                    || blockers.HasPendingSync
                    || blockers.IsSyncing
                    || blockers.PendingCount > 0;
            }

            var result = DeserializeScriptResult<PendingSyncStatusResult>(rawResult);
            return result is not null && (result.HasPending || result.IsSyncing || result.Count > 0);
        }
        catch
        {
            return false;
        }
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

    private bool IsHiddenToTrayState()
    {
        return _startInBackground || !Visible || !ShowInTaskbar || WindowState == FormWindowState.Minimized;
    }

    private static string AppendCacheBust(string url)
    {
        var separator = url.Contains('?') ? "&" : "?";
        return $"{url}{separator}v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
    }

    private void NavigateToRelativePage(string relativePage, bool saveState = true)
    {
        if (!_webViewReady)
        {
            _currentRelativePage = NormalizeRelativePage(relativePage);
            return;
        }

        var normalizedRelativePage = NormalizeRelativePage(relativePage);
        var pagePath = Path.Combine(
            _webRootPath,
            normalizedRelativePage.Replace('/', Path.DirectorySeparatorChar)
        );

        if (!File.Exists(pagePath))
        {
            MessageBox.Show(
                this,
                $"Не найден локальный файл страницы:\n{pagePath}",
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
            return;
        }

        var targetUri = BuildPageUri(pagePath, _shellState.Mode);
        _currentRelativePage = normalizedRelativePage;
        if (saveState)
        {
            _shellState = _shellState with { LastRelativePage = normalizedRelativePage };
            SaveShellState();
        }

        webView.Source = targetUri;
        UpdateCurrentPageStatus();
    }

    private void HandleModeAwareNavigation(CoreWebView2NavigationStartingEventArgs args)
    {
        if (!_webViewReady || string.IsNullOrWhiteSpace(args.Uri))
        {
            return;
        }

        if (!TryBuildModeAwareUri(args.Uri, _shellState.Mode, out var redirectUri))
        {
            return;
        }

        if (string.Equals(args.Uri, redirectUri.AbsoluteUri, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        args.Cancel = true;
        webView.CoreWebView2.Navigate(redirectUri.AbsoluteUri);
    }

    private Uri BuildPageUri(string pagePath, DesktopMode mode)
    {
        var builder = new UriBuilder(new Uri(pagePath))
        {
            Query = mode == DesktopMode.Online ? BuildRemoteQueryString() : string.Empty
        };
        return builder.Uri;
    }

    private static string BuildRemoteQueryString()
    {
        var query = new Dictionary<string, string>
        {
            ["sync"] = "supabase-function",
            ["sbUrl"] = RemoteSupabaseUrl,
            ["sbKey"] = RemoteSupabaseAnonKey,
            ["fn"] = RemoteFunctionName,
            ["oa"] = "1"
        };

        return string.Join("&", query.Select(pair =>
            $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"
        ));
    }

    private bool TryBuildModeAwareUri(string rawUri, DesktopMode mode, out Uri redirectUri)
    {
        redirectUri = null!;

        if (!Uri.TryCreate(rawUri, UriKind.Absolute, out var parsedUri) || !parsedUri.IsFile)
        {
            return false;
        }

        try
        {
            var localPath = Path.GetFullPath(parsedUri.LocalPath);
            var rootWithSeparator = _webRootPath.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!localPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(localPath, _webRootPath, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            redirectUri = BuildPageUri(localPath, mode);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void CaptureCurrentRelativePageFromWebView()
    {
        if (webView.Source is null || !webView.Source.IsFile)
        {
            return;
        }

        try
        {
            var fullPath = Path.GetFullPath(webView.Source.LocalPath);
            var relativePath = Path.GetRelativePath(_webRootPath, fullPath)
                .Replace(Path.DirectorySeparatorChar, '/');
            if (!string.IsNullOrWhiteSpace(relativePath) && !relativePath.StartsWith("..", StringComparison.Ordinal))
            {
                _currentRelativePage = NormalizeRelativePage(relativePath);
                _shellState = _shellState with { LastRelativePage = _currentRelativePage };
            }
        }
        catch
        {
        }
    }

    private void OpenDataFolder()
    {
        try
        {
            Directory.CreateDirectory(_appDataRoot);
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"\"{_appDataRoot}\"",
                UseShellExecute = true
            });
        }
        catch (Exception error)
        {
            MessageBox.Show(
                this,
                $"Не удалось открыть папку данных.\n\n{error.Message}",
                "Mainflow Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private void UpdateBannerText()
    {
        bannerLabel.Text = _shellState.Mode == DesktopMode.Offline
            ? "Оффлайн-режим: ввод и просмотр работают локально на этом ПК. Новые изменения попадают в оффлайн-очередь и после возврата связи отправляются автоматически в фоне."
            : "Онлайн-режим: локальная копия сайта работает с сервером и получает новые данные автоматически. Уведомления приходят в фоне, а обновления Mainflow устанавливаются автоматически, когда нет несохранённых изменений.";
    }

    private void UpdateNetworkStatus()
    {
        var hasInternet = HasInternetAvailable();
        toolStripLabelNetwork.Text = $"Интернет: {(hasInternet ? "есть" : "нет")}";
        toolStripStatusLabelNetworkValue.Text = hasInternet ? "есть" : "нет";
        toolStripStatusLabelNetworkValue.ForeColor = hasInternet ? Color.DarkGreen : Color.Firebrick;
    }

    private void UpdateCurrentPageStatus()
    {
        var title = _pageTitles.TryGetValue(_currentRelativePage, out var pageTitle)
            ? pageTitle
            : _currentRelativePage;
        toolStripStatusLabelPage.Text = $"Страница: {title}";
        toolStripStatusLabelModeValue.Text = _shellState.Mode == DesktopMode.Online ? "онлайн" : "оффлайн";
    }

    private void UpdateAutoStartUi()
    {
        var enabled = _shellState.AutoStartEnabled;
        _toolStripButtonAutoStart.Text = enabled ? "Автозапуск: вкл" : "Автозапуск: выкл";
        _trayMenuAutoStart.Checked = enabled;
        _trayMenuAutoStart.Text = enabled ? "Запускать с Windows: вкл" : "Запускать с Windows: выкл";
    }

    private DesktopMode GetSafeInitialMode()
    {
        if (_shellState.Mode == DesktopMode.Online && !HasInternetAvailable())
        {
            _shellState = _shellState with { Mode = DesktopMode.Offline };
        }

        return _shellState.Mode;
    }

    private void ApplyModeToUi(DesktopMode mode)
    {
        _suppressModeEvents = true;
        try
        {
            toolStripComboBoxMode.SelectedIndex = mode == DesktopMode.Online ? 1 : 0;
            _shellState = _shellState with { Mode = mode };
        }
        finally
        {
            _suppressModeEvents = false;
        }
    }

    private DesktopMode GetSelectedMode()
    {
        return toolStripComboBoxMode.SelectedIndex == 1
            ? DesktopMode.Online
            : DesktopMode.Offline;
    }

    private static bool HasInternetAvailable()
    {
        try
        {
            return NetworkInterface.GetIsNetworkAvailable();
        }
        catch
        {
            return false;
        }
    }

    private void HandleResizeToTray()
    {
        if (WindowState == FormWindowState.Minimized)
        {
            HideToTray(
                showBalloon: !_trayHintShown,
                title: "Mainflow свернут в трей",
                message: "Приложение продолжит работать в фоне. Для возврата дважды нажмите значок возле часов."
            );
        }
    }

    private void HandleInitialBackgroundLaunch()
    {
        if (!_startInBackground || _backgroundLaunchHandled)
        {
            return;
        }

        _backgroundLaunchHandled = true;
        HideToTray(
            showBalloon: true,
            title: "Mainflow запущен в фоне",
            message: "Приложение автоматически стартовало вместе с Windows и будет показывать уведомления о новых данных."
        );
    }

    private void HideToTray(bool showBalloon = false, string? title = null, string? message = null)
    {
        if (!Visible && !ShowInTaskbar)
        {
            if (showBalloon)
            {
                ShowTrayBalloon(title ?? "Mainflow в фоне", message ?? "Приложение продолжает работать в трее.");
            }
            return;
        }

        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        Hide();

        if (showBalloon)
        {
            ShowTrayBalloon(title ?? "Mainflow в фоне", message ?? "Приложение продолжает работать в трее.");
        }

        if (!string.IsNullOrWhiteSpace(_pendingUpdateToken))
        {
            FireAndForgetAutoUpdateCheck(2000);
        }
    }

    private void RestoreFromTray()
    {
        Show();
        ShowInTaskbar = true;
        WindowState = FormWindowState.Normal;
        Activate();
    }

    private void ExitApplication()
    {
        _allowClose = true;
        _trayIcon.Visible = false;
        Close();
    }

    private void HandleFormClosing(object? sender, FormClosingEventArgs args)
    {
        SaveShellState();

        if (_allowClose
            || args.CloseReason == CloseReason.ApplicationExitCall
            || args.CloseReason == CloseReason.WindowsShutDown
            || args.CloseReason == CloseReason.TaskManagerClosing)
        {
            _trayIcon.Visible = false;
            return;
        }

        args.Cancel = true;
        HideToTray(
            showBalloon: true,
            title: "Mainflow продолжит работать",
            message: "Окно закрыто в трей. Используйте значок возле часов, чтобы вернуться или выйти."
        );
    }

    private void ToggleAutoStartPreference()
    {
        var nextState = !_shellState.AutoStartEnabled;
        _shellState = _shellState with { AutoStartEnabled = nextState };
        if (!ApplyAutoStartPreference(silent: false))
        {
            _shellState = _shellState with { AutoStartEnabled = !nextState };
            UpdateAutoStartUi();
            return;
        }

        SaveShellState();
        UpdateAutoStartUi();
        ShowTrayBalloon(
            "Автозапуск обновлен",
            nextState
                ? "Mainflow будет стартовать вместе с Windows в фоновом режиме."
                : "Автозапуск Mainflow отключен."
        );
    }

    private bool ApplyAutoStartPreference(bool silent)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(AutoStartRegistryPath, writable: true)
                ?? Registry.CurrentUser.CreateSubKey(AutoStartRegistryPath);
            if (key is null)
            {
                throw new InvalidOperationException("Не удалось открыть раздел автозапуска Windows.");
            }

            if (_shellState.AutoStartEnabled)
            {
                key.SetValue(
                    AutoStartRegistryValueName,
                    $"\"{Application.ExecutablePath}\" --background",
                    RegistryValueKind.String
                );
            }
            else
            {
                key.DeleteValue(AutoStartRegistryValueName, throwOnMissingValue: false);
            }

            UpdateAutoStartUi();
            return true;
        }
        catch (Exception error)
        {
            if (!silent)
            {
                MessageBox.Show(
                    this,
                    $"Не удалось изменить автозапуск Windows.\n\n{error.Message}",
                    "Mainflow Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }

            return false;
        }
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
            if (!string.Equals(type, "desktop-notification", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var title = root.TryGetProperty("title", out var titleElement)
                ? titleElement.GetString() ?? "Mainflow"
                : "Mainflow";
            var message = root.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString() ?? string.Empty
                : string.Empty;

            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            ShowTrayBalloon(title, message);
        }
        catch
        {
        }
    }

    private void ShowTrayBalloon(string title, string message)
    {
        var safeTitle = LimitBalloonText(title, 63);
        var safeMessage = LimitBalloonText(message, 255);
        if (string.IsNullOrWhiteSpace(safeMessage))
        {
            return;
        }

        _trayHintShown = true;
        _trayIcon.BalloonTipTitle = safeTitle;
        _trayIcon.BalloonTipText = safeMessage;
        _trayIcon.BalloonTipIcon = ToolTipIcon.Info;
        _trayIcon.ShowBalloonTip(8000);
    }

    private static string LimitBalloonText(string? value, int maxLength)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        return normalized[..Math.Max(0, maxLength - 1)] + "…";
    }

    private static T? DeserializeScriptResult<T>(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(rawJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch
        {
            return default;
        }
    }

    private string NormalizeRelativePage(string? relativePage)
    {
        var normalized = string.IsNullOrWhiteSpace(relativePage)
            ? DefaultRelativePage
            : relativePage.Trim().Replace('\\', '/');

        if (normalized.StartsWith('/'))
        {
            normalized = normalized.TrimStart('/');
        }

        if (normalized.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            return DefaultRelativePage;
        }

        return normalized;
    }

    private DesktopShellState LoadShellState()
    {
        try
        {
            if (!File.Exists(_stateFilePath))
            {
                return DesktopShellState.Default;
            }

            var raw = File.ReadAllText(_stateFilePath);
            var parsed = JsonSerializer.Deserialize<DesktopShellState>(raw, _jsonOptions);
            return parsed is null
                ? DesktopShellState.Default
                : parsed with
                {
                    LastRelativePage = NormalizeRelativePage(parsed.LastRelativePage)
                };
        }
        catch
        {
            return DesktopShellState.Default;
        }
    }

    private void SaveShellState()
    {
        try
        {
            Directory.CreateDirectory(_appDataRoot);
            var nextState = _shellState with { LastRelativePage = NormalizeRelativePage(_currentRelativePage) };
            File.WriteAllText(_stateFilePath, JsonSerializer.Serialize(nextState, _jsonOptions));
        }
        catch
        {
        }
    }

    private enum DesktopMode
    {
        Offline,
        Online
    }

    private sealed record DesktopShellState
    {
        public DesktopMode Mode { get; init; } = DesktopMode.Offline;
        public string LastRelativePage { get; init; } = DefaultRelativePage;
        public bool AutoStartEnabled { get; init; } = true;

        public static DesktopShellState Default { get; } = new();
    }

    private sealed record PendingSyncCommandResult(bool Ok, int SyncedCount, int RemainingCount, string Error);
    private sealed record PendingSyncStatusResult(bool HasPending, int Count, bool IsSyncing);
    private sealed record DesktopUpdateBlockersResult(bool HasBlockingWork, bool HasBlockingUiWork, bool HasPendingSync, int PendingCount, bool IsSyncing);

    private sealed class DesktopPackageManifest
    {
        public string GeneratedAtUtc { get; init; } = string.Empty;
        public List<DesktopPackageFile> Files { get; init; } = new();
    }

    private sealed class DesktopPackageFile
    {
        public string Path { get; init; } = string.Empty;
        public long Size { get; init; }
        public string Sha256 { get; init; } = string.Empty;
    }
}
