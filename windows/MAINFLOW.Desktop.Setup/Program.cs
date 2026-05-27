using System.Diagnostics;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace MAINFLOW.Desktop.Setup;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new InstallerForm());
    }
}

internal sealed class InstallerForm : Form
{
    private const string ReleaseBaseUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/MAINFLOW.Desktop/";
    private const string ManifestFileName = "package-manifest.json";
    private const string InstallFolderName = "MAINFLOW Desktop";
    private const string DesktopShortcutName = "MAINFLOW Desktop.lnk";

    private readonly Label _statusLabel;
    private readonly ProgressBar _progressBar;
    private readonly string _logPath;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(20)
    };

    public InstallerForm()
    {
        _logPath = Path.Combine(Path.GetTempPath(), "MAINFLOW.Desktop.Setup.log");
        Text = "MAINFLOW Desktop Setup";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(520, 136);

        var titleLabel = new Label
        {
            AutoSize = true,
            Font = new Font("Segoe UI", 12F, FontStyle.Bold, GraphicsUnit.Point),
            Location = new Point(18, 16),
            Text = "Установка MAINFLOW Desktop"
        };

        _statusLabel = new Label
        {
            AutoSize = false,
            Location = new Point(18, 52),
            Size = new Size(484, 36),
            Text = "Подготовка..."
        };

        _progressBar = new ProgressBar
        {
            Location = new Point(18, 94),
            Size = new Size(484, 22),
            Minimum = 0,
            Maximum = 100,
            Style = ProgressBarStyle.Continuous
        };

        Controls.Add(titleLabel);
        Controls.Add(_statusLabel);
        Controls.Add(_progressBar);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        await RunInstallAsync();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _httpClient.Dispose();
        }

        base.Dispose(disposing);
    }

    private async Task RunInstallAsync()
    {
        try
        {
            Log("Setup started.");
            var installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                InstallFolderName
            );
            var executablePath = Path.Combine(installDir, "MAINFLOW.Desktop.exe");

            SetStatus("Останавливаю запущенные копии MAINFLOW...", 4);
            Log("Stopping running desktop instances.");
            StopRunningDesktopInstances();

            SetStatus("Проверяю пакет установки...", 10);
            Log("Resolving manifest source.");
            var manifestSource = await ResolveManifestSourceAsync();
            Log($"Manifest source: {manifestSource.Location} (local={manifestSource.IsLocal}).");
            var manifest = await LoadManifestAsync(manifestSource);
            Log($"Manifest loaded. Files: {manifest.Files.Count}.");
            if (manifest.Files.Count == 0)
            {
                throw new InvalidOperationException("Установочный пакет пуст. Не найдено файлов для загрузки.");
            }

            SetStatus("Подготавливаю папку установки...", 14);
            Log("Preparing install directory.");
            PrepareInstallDirectory(installDir);

            Log("Copying package files.");
            await DownloadOrCopyFilesAsync(manifestSource, manifest, installDir);
            Log("Files copied successfully.");
            CreateDesktopShortcut(executablePath, installDir);
            Log("Desktop shortcut updated.");

            if (!File.Exists(executablePath))
            {
                throw new FileNotFoundException("После установки не найден файл MAINFLOW.Desktop.exe.", executablePath);
            }

            SetStatus("Запускаю MAINFLOW Desktop...", 98);
            Log("Launching installed desktop app.");
            Process.Start(new ProcessStartInfo
            {
                FileName = executablePath,
                WorkingDirectory = installDir,
                UseShellExecute = true
            });

            SetStatus("Готово. MAINFLOW Desktop запущен.", 100);
            Log("Setup finished successfully. Closing installer.");
            await Task.Delay(1200);
            Close();
        }
        catch (Exception error)
        {
            Log($"Setup failed: {error}");
            MessageBox.Show(
                $"Не удалось установить MAINFLOW Desktop.\n\n{error.Message}",
                "MAINFLOW Desktop Setup",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            Close();
        }
    }

    private void SetStatus(string text, int percent)
    {
        Log($"Status: {text} ({percent}%).");
        _statusLabel.Text = text;
        _progressBar.Value = Math.Max(_progressBar.Minimum, Math.Min(_progressBar.Maximum, percent));
        Application.DoEvents();
    }

    private void Log(string message)
    {
        try
        {
            File.AppendAllText(_logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
        }
        catch
        {
        }
    }

    private async Task<ManifestSource> ResolveManifestSourceAsync()
    {
        var localManifestPath = Path.Combine(AppContext.BaseDirectory, "MAINFLOW.Desktop", ManifestFileName);
        if (File.Exists(localManifestPath))
        {
            return new ManifestSource(new Uri(localManifestPath), IsLocal: true);
        }

        var remoteManifestUri = new Uri(new Uri(ReleaseBaseUrl), ManifestFileName);
        using var request = new HttpRequestMessage(HttpMethod.Head, remoteManifestUri);
        using var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return new ManifestSource(remoteManifestUri, IsLocal: false);
    }

    private async Task<DesktopPackageManifest> LoadManifestAsync(ManifestSource source)
    {
        if (source.IsLocal)
        {
            var json = await File.ReadAllTextAsync(source.Location.LocalPath);
            return JsonSerializer.Deserialize<DesktopPackageManifest>(json, _jsonOptions)
                ?? throw new InvalidOperationException("Не удалось прочитать локальный package-manifest.json.");
        }

        using var stream = await _httpClient.GetStreamAsync(source.Location);
        return await JsonSerializer.DeserializeAsync<DesktopPackageManifest>(stream, _jsonOptions)
            ?? throw new InvalidOperationException("Не удалось загрузить package-manifest.json с сервера.");
    }

    private async Task DownloadOrCopyFilesAsync(ManifestSource source, DesktopPackageManifest manifest, string installDir)
    {
        var totalFiles = manifest.Files.Count;
        for (var index = 0; index < totalFiles; index++)
        {
            var file = manifest.Files[index];
            if (string.IsNullOrWhiteSpace(file.Path))
            {
                continue;
            }

            var safeRelativePath = file.Path.Replace('/', Path.DirectorySeparatorChar);
            var destinationPath = Path.GetFullPath(Path.Combine(installDir, safeRelativePath));
            if (!destinationPath.StartsWith(installDir, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Обнаружен небезопасный путь в пакете: {file.Path}");
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

            var percent = 15 + (int)Math.Round(((index + 1d) / totalFiles) * 80d);
            SetStatus($"Загружаю {index + 1}/{totalFiles}: {file.Path}", percent);

            if (source.IsLocal)
            {
                var sourceFilePath = Path.Combine(Path.GetDirectoryName(source.Location.LocalPath)!, safeRelativePath);
                File.Copy(sourceFilePath, destinationPath, overwrite: true);
                continue;
            }

            var downloadUri = BuildRemoteFileUri(file.Path);
            using var response = await _httpClient.GetAsync(downloadUri, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            await using var input = await response.Content.ReadAsStreamAsync();
            await using var output = File.Create(destinationPath);
            await input.CopyToAsync(output);
        }
    }

    private static Uri BuildRemoteFileUri(string relativePath)
    {
        var normalizedPath = relativePath.Replace('\\', '/');
        var segments = normalizedPath
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(Uri.EscapeDataString);
        var escapedPath = string.Join("/", segments);
        return new Uri(new Uri(ReleaseBaseUrl), escapedPath);
    }

    private static void PrepareInstallDirectory(string installDir)
    {
        if (Directory.Exists(installDir))
        {
            foreach (var filePath in Directory.EnumerateFiles(installDir, "*", SearchOption.AllDirectories))
            {
                try
                {
                    File.SetAttributes(filePath, FileAttributes.Normal);
                }
                catch
                {
                }
            }

            Directory.Delete(installDir, recursive: true);
        }

        Directory.CreateDirectory(installDir);
    }

    private static void StopRunningDesktopInstances()
    {
        foreach (var process in Process.GetProcessesByName("MAINFLOW.Desktop"))
        {
            try
            {
                if (!process.HasExited)
                {
                    process.CloseMainWindow();
                    if (!process.WaitForExit(1500))
                    {
                        process.Kill(entireProcessTree: true);
                        process.WaitForExit(5000);
                    }
                }
            }
            catch
            {
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void CreateDesktopShortcut(string executablePath, string workingDirectory)
    {
        var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrWhiteSpace(desktopPath))
        {
            return;
        }

        var shortcutPath = Path.Combine(desktopPath, DesktopShortcutName);
        Type? shellType = null;
        object? shell = null;
        object? shortcut = null;

        try
        {
            shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null)
            {
                return;
            }

            shell = Activator.CreateInstance(shellType);
            if (shell is null)
            {
                return;
            }

            shortcut = shellType.InvokeMember(
                "CreateShortcut",
                System.Reflection.BindingFlags.InvokeMethod,
                binder: null,
                target: shell,
                args: new object[] { shortcutPath }
            );
            if (shortcut is null)
            {
                return;
            }

            var shortcutType = shortcut.GetType();
            shortcutType.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { executablePath });
            shortcutType.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
            shortcutType.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { $"{executablePath},0" });
            shortcutType.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, Array.Empty<object>());
        }
        finally
        {
            if (shortcut is not null && Marshal.IsComObject(shortcut))
            {
                Marshal.FinalReleaseComObject(shortcut);
            }
            if (shell is not null && Marshal.IsComObject(shell))
            {
                Marshal.FinalReleaseComObject(shell);
            }
        }
    }

    private sealed record ManifestSource(Uri Location, bool IsLocal);
}

internal sealed class DesktopPackageManifest
{
    public List<DesktopPackageFile> Files { get; init; } = new();
}

internal sealed class DesktopPackageFile
{
    public string Path { get; init; } = string.Empty;
    public long Size { get; init; }
}
