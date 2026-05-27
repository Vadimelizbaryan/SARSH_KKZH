using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MAINFLOW.Desktop;

public partial class Form1 : Form
{
    private const string DefaultRelativePage = "index.html";
    private const string RemoteSupabaseUrl = "https://ywecvlapdlaojpvijaqy.supabase.co";
    private const string RemoteSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3ZWN2bGFwZGxhb2pwdmlqYXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTAzMjgsImV4cCI6MjA5MzYyNjMyOH0._HEPdPB2bBTo_N-1Qo8jLau5g5oYGgvoGnBWPxDupL4";
    private const string RemoteFunctionName = "sharsh-sync";

    private readonly string _webRootPath;
    private readonly string _appDataRoot;
    private readonly string _webViewUserDataPath;
    private readonly string _stateFilePath;
    private readonly Dictionary<string, string> _pageTitles = new(StringComparer.OrdinalIgnoreCase)
    {
        [DefaultRelativePage] = "Главная таблица",
        ["setup.html"] = "Настройки",
        ["ocr-feedback.html"] = "OCR журнал"
    };

    private DesktopShellState _shellState;
    private bool _suppressModeEvents;
    private bool _webViewReady;
    private string _currentRelativePage = DefaultRelativePage;

    public Form1()
    {
        InitializeComponent();

        _webRootPath = AppContext.BaseDirectory;
        _appDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MAINFLOW.Desktop"
        );
        _webViewUserDataPath = Path.Combine(_appDataRoot, "WebView2");
        _stateFilePath = Path.Combine(_appDataRoot, "desktop-state.json");

        Directory.CreateDirectory(_appDataRoot);
        Directory.CreateDirectory(_webViewUserDataPath);

        _shellState = LoadShellState();
        _currentRelativePage = NormalizeRelativePage(_shellState.LastRelativePage);

        webView.CreationProperties = new CoreWebView2CreationProperties
        {
            UserDataFolder = _webViewUserDataPath
        };

        toolStripComboBoxMode.Items.Clear();
        toolStripComboBoxMode.Items.AddRange(["Оффлайн", "Онлайн"]);
        ApplyModeToUi(GetSafeInitialMode());
        UpdateBannerText();
        UpdateNetworkStatus();
        UpdateCurrentPageStatus();

        toolStripButtonHome.Click += (_, _) => NavigateToRelativePage(DefaultRelativePage);
        toolStripButtonSetup.Click += (_, _) => NavigateToRelativePage("setup.html");
        toolStripButtonFeedback.Click += (_, _) => NavigateToRelativePage("ocr-feedback.html");
        toolStripButtonReload.Click += (_, _) => ReloadCurrentPage();
        toolStripButtonOpenDataFolder.Click += (_, _) => OpenDataFolder();
        toolStripComboBoxMode.SelectedIndexChanged += (_, _) => HandleModeChangedFromUi();
        networkTimer.Tick += (_, _) => UpdateNetworkStatus();
        Shown += async (_, _) => await InitializeWebViewAsync();
        FormClosing += (_, _) => SaveShellState();
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
            webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                if (!string.IsNullOrWhiteSpace(args.Uri))
                {
                    if (TryBuildModeAwareUri(args.Uri, _shellState.Mode, out var redirectUri))
                    {
                        webView.CoreWebView2.Navigate(redirectUri.AbsoluteUri);
                        return;
                    }

                    webView.CoreWebView2.Navigate(args.Uri);
                }
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
                "MAINFLOW Desktop",
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
                "MAINFLOW Desktop",
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
    }

    private void ReloadCurrentPage()
    {
        if (!_webViewReady)
        {
            return;
        }

        NavigateToRelativePage(_currentRelativePage, saveState: false);
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
                "MAINFLOW Desktop",
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
        var builder = new UriBuilder(new Uri(pagePath));
        builder.Query = mode == DesktopMode.Online
            ? BuildRemoteQueryString()
            : "";
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
                "MAINFLOW Desktop",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private void UpdateBannerText()
    {
        bannerLabel.Text = _shellState.Mode == DesktopMode.Offline
            ? "Оффлайн-режим: ввод и просмотр работают локально на этом ПК. Следующий обязательный этап — очередь синхронизации, чтобы безопасно отправлять накопленные оффлайн-изменения обратно на сервер."
            : "Онлайн-режим: используется локальная копия сайта, но данные берутся и сохраняются через сервер. Если интернет пропадёт, переключитесь в оффлайн, чтобы работа не остановилась.";
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

    private string NormalizeRelativePage(string? relativePage)
    {
        var normalized = string.IsNullOrWhiteSpace(relativePage)
            ? DefaultRelativePage
            : relativePage.Trim().Replace('\\', '/');

        if (normalized.StartsWith("/"))
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
            var parsed = JsonSerializer.Deserialize<DesktopShellState>(raw);
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
            File.WriteAllText(
                _stateFilePath,
                JsonSerializer.Serialize(nextState, new JsonSerializerOptions
                {
                    WriteIndented = true
                })
            );
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

    private sealed record DesktopShellState(DesktopMode Mode, string LastRelativePage)
    {
        public static DesktopShellState Default { get; } = new(DesktopMode.Offline, DefaultRelativePage);
    }
}
