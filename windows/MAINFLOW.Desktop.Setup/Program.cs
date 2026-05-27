using System.Diagnostics;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;

namespace MAINFLOW.Desktop.Setup;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new InstallerForm(InstallOptions.Parse(args)));
    }
}

internal sealed class InstallerForm : Form
{
    private const string ReleaseBaseUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/MAINFLOW.Desktop/";
    private const string ManifestFileName = "package-manifest.json";
    private const string InstallFolderName = "MAINFLOW Desktop";
    private const string DesktopShortcutName = "MAINFLOW Desktop.lnk";
    private const string InstalledExecutableName = "Mainflow.exe";
    private const string InstalledProcessName = "Mainflow";

    private readonly InstallOptions _options;
    private readonly Label _statusLabel;
    private readonly ProgressBar _progressBar;
    private readonly string _logPath;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(20)
    };

    public InstallerForm(InstallOptions options)
    {
        _options = options;
        _logPath = Path.Combine(Path.GetTempPath(), "Mainflow.Setup.log");

        Text = options.SilentMode ? "Mainflow Update" : "Mainflow Setup";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(560, 142);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;

        if (_options.SilentMode)
        {
            ShowInTaskbar = false;
            Opacity = 0;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-32000, -32000);
        }

        var titleLabel = new Label
        {
            AutoSize = true,
            Font = new Font("Segoe UI", 12F, FontStyle.Bold, GraphicsUnit.Point),
            Location = new Point(18, 16),
            Text = _options.SilentMode ? "Обновление Mainflow" : "Установка Mainflow"
        };

        _statusLabel = new Label
        {
            AutoSize = false,
            Location = new Point(18, 52),
            Size = new Size(524, 36),
            Text = "Подготовка..."
        };

        _progressBar = new ProgressBar
        {
            Location = new Point(18, 96),
            Size = new Size(524, 22),
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
        var installDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            InstallFolderName
        );
        var executablePath = Path.Combine(installDir, InstalledExecutableName);

        try
        {
            Log("Installer started.");
            SetStatus("Останавливаю запущенные копии Mainflow...", 4);
            StopRunningDesktopInstances();

            SetStatus("Проверяю пакет установки...", 10);
            var manifestSource = await ResolveManifestSourceAsync();
            Log($"Manifest source: {manifestSource.Location} (local={manifestSource.IsLocal}).");

            var manifest = await LoadManifestAsync(manifestSource);
            if (manifest.Files.Count == 0)
            {
                throw new InvalidOperationException("Установочный пакет пуст. Не найдено файлов для установки.");
            }

            SetStatus("Подготавливаю папку установки...", 14);
            Directory.CreateDirectory(installDir);
            var existingManifest = await TryLoadInstallManifestAsync(installDir);

            await TransferPackageFilesAsync(manifestSource, manifest, existingManifest, installDir);
            RemoveFilesMissingInNewManifest(existingManifest, manifest, installDir);
            RemoveLegacyDesktopFiles(installDir);
            await WriteInstallManifestAsync(installDir, manifest);
            DeleteEmptyDirectories(installDir);
            CreateDesktopShortcut(executablePath, installDir);

            if (!File.Exists(executablePath))
            {
                throw new FileNotFoundException("После установки не найден файл Mainflow.exe.", executablePath);
            }

            SetStatus("Запускаю Mainflow...", 98);
            StartInstalledApplication(executablePath, installDir, _options.RestartInBackground);

            SetStatus("Готово. Mainflow запущен.", 100);
            Log("Installer finished successfully.");

            if (!_options.SilentMode)
            {
                MessageBox.Show(
                    $"Mainflow установлен в:\n{installDir}\n\nПриложение уже запущено.",
                    "Mainflow Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
        }
        catch (Exception error)
        {
            Log($"Installer failed: {error}");

            if (_options.SilentMode)
            {
                TryStartInstalledApplication(executablePath, installDir, _options.RestartInBackground);
            }
            else
            {
                MessageBox.Show(
                    $"Не удалось установить Mainflow.\n\n{error.Message}",
                    "Mainflow Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
        finally
        {
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
        if (!_options.ForceRemoteManifest)
        {
            var localManifestPath = Path.Combine(AppContext.BaseDirectory, "MAINFLOW.Desktop", ManifestFileName);
            if (File.Exists(localManifestPath))
            {
                return new ManifestSource(new Uri(localManifestPath), true, Path.GetDirectoryName(localManifestPath)!);
            }
        }

        var remoteManifestUri = new Uri(new Uri(ReleaseBaseUrl), ManifestFileName);
        using var request = new HttpRequestMessage(HttpMethod.Head, remoteManifestUri);
        using var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        return new ManifestSource(remoteManifestUri, false, null);
    }

    private async Task<DesktopPackageManifest> LoadManifestAsync(ManifestSource source)
    {
        if (source.IsLocal)
        {
            var json = await File.ReadAllTextAsync(source.Location.LocalPath);
            return JsonSerializer.Deserialize<DesktopPackageManifest>(json, _jsonOptions)
                ?? throw new InvalidOperationException("Не удалось прочитать локальный package-manifest.json.");
        }

        using var stream = await _httpClient.GetStreamAsync(AppendCacheBust(source.Location));
        return await JsonSerializer.DeserializeAsync<DesktopPackageManifest>(stream, _jsonOptions)
            ?? throw new InvalidOperationException("Не удалось загрузить package-manifest.json с сервера.");
    }

    private async Task<DesktopPackageManifest?> TryLoadInstallManifestAsync(string installDir)
    {
        var manifestPath = Path.Combine(installDir, ManifestFileName);
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

    private async Task TransferPackageFilesAsync(
        ManifestSource source,
        DesktopPackageManifest manifest,
        DesktopPackageManifest? existingManifest,
        string installDir
    )
    {
        var existingEntries = BuildManifestEntryMap(existingManifest);
        var normalizedEntries = manifest.Files
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Path))
            .OrderBy(entry => entry.Path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var total = Math.Max(1, normalizedEntries.Count);
        for (var index = 0; index < normalizedEntries.Count; index++)
        {
            var entry = normalizedEntries[index];
            var destinationPath = GetSafeDestinationPath(installDir, entry.Path);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

            if (FileMatchesManifest(destinationPath, entry, existingEntries.TryGetValue(NormalizeManifestPath(entry.Path), out var existingEntry) ? existingEntry : null))
            {
                continue;
            }

            var percent = 16 + (int)Math.Round(((index + 1d) / total) * 78d);
            SetStatus($"Обновляю {index + 1}/{total}: {entry.Path}", percent);

            if (source.IsLocal)
            {
                var sourcePath = Path.Combine(source.LocalManifestRoot!, entry.Path.Replace('/', Path.DirectorySeparatorChar));
                File.Copy(sourcePath, destinationPath, overwrite: true);
                continue;
            }

            using var response = await _httpClient.GetAsync(BuildRemoteFileUri(entry.Path), HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            await using var input = await response.Content.ReadAsStreamAsync();
            await using var output = File.Create(destinationPath);
            await input.CopyToAsync(output);
        }
    }

    private async Task WriteInstallManifestAsync(string installDir, DesktopPackageManifest manifest)
    {
        var manifestPath = Path.Combine(installDir, ManifestFileName);
        var json = JsonSerializer.Serialize(manifest, _jsonOptions);
        await File.WriteAllTextAsync(manifestPath, json);
    }

    private static Dictionary<string, DesktopPackageFile> BuildManifestEntryMap(DesktopPackageManifest? manifest)
    {
        if (manifest is null || manifest.Files.Count == 0)
        {
            return new Dictionary<string, DesktopPackageFile>(StringComparer.OrdinalIgnoreCase);
        }

        return manifest.Files
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Path))
            .GroupBy(entry => NormalizeManifestPath(entry.Path), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last(), StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeManifestPath(string path)
    {
        return path.Replace('\\', '/').TrimStart('/');
    }

    private static string GetSafeDestinationPath(string installDir, string manifestPath)
    {
        var safeRelativePath = NormalizeManifestPath(manifestPath).Replace('/', Path.DirectorySeparatorChar);
        var destinationPath = Path.GetFullPath(Path.Combine(installDir, safeRelativePath));
        var rootWithSeparator = Path.GetFullPath(installDir).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!destinationPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Обнаружен небезопасный путь в пакете: {manifestPath}");
        }

        return destinationPath;
    }

    private static bool FileMatchesManifest(string destinationPath, DesktopPackageFile expected, DesktopPackageFile? existingManifestEntry)
    {
        if (!File.Exists(destinationPath))
        {
            return false;
        }

        var info = new FileInfo(destinationPath);
        if (expected.Size > 0 && info.Length != expected.Size)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(expected.Sha256))
        {
            return true;
        }

        if (existingManifestEntry is not null
            && existingManifestEntry.Size == expected.Size
            && string.Equals(existingManifestEntry.Sha256, expected.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return string.Equals(ComputeSha256(destinationPath), expected.Sha256, StringComparison.OrdinalIgnoreCase);
    }

    private static string ComputeSha256(string filePath)
    {
        using var stream = File.OpenRead(filePath);
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(stream));
    }

    private static void RemoveFilesMissingInNewManifest(
        DesktopPackageManifest? existingManifest,
        DesktopPackageManifest manifest,
        string installDir
    )
    {
        if (existingManifest is null || existingManifest.Files.Count == 0)
        {
            return;
        }

        var nextPaths = manifest.Files
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Path))
            .Select(entry => NormalizeManifestPath(entry.Path))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var existing in existingManifest.Files)
        {
            if (string.IsNullOrWhiteSpace(existing.Path))
            {
                continue;
            }

            var normalized = NormalizeManifestPath(existing.Path);
            if (nextPaths.Contains(normalized))
            {
                continue;
            }

            var filePath = GetSafeDestinationPath(installDir, normalized);
            if (File.Exists(filePath))
            {
                File.SetAttributes(filePath, FileAttributes.Normal);
                File.Delete(filePath);
            }
        }
    }

    private static void DeleteEmptyDirectories(string installDir)
    {
        if (!Directory.Exists(installDir))
        {
            return;
        }

        foreach (var directory in Directory.GetDirectories(installDir, "*", SearchOption.AllDirectories)
                     .OrderByDescending(path => path.Length))
        {
            try
            {
                if (!Directory.EnumerateFileSystemEntries(directory).Any())
                {
                    Directory.Delete(directory, recursive: false);
                }
            }
            catch
            {
            }
        }
    }

    private static void RemoveLegacyDesktopFiles(string installDir)
    {
        string[] legacyFileNames =
        [
            "MAINFLOW.Desktop.deps.json",
            "MAINFLOW.Desktop.dll",
            "MAINFLOW.Desktop.exe",
            "MAINFLOW.Desktop.pdb",
            "MAINFLOW.Desktop.runtimeconfig.json"
        ];

        foreach (var fileName in legacyFileNames)
        {
            try
            {
                var filePath = Path.Combine(installDir, fileName);
                if (!File.Exists(filePath))
                {
                    continue;
                }

                File.SetAttributes(filePath, FileAttributes.Normal);
                File.Delete(filePath);
            }
            catch
            {
            }
        }
    }

    private static Uri AppendCacheBust(Uri uri)
    {
        var separator = string.IsNullOrWhiteSpace(uri.Query) ? "?" : "&";
        return new Uri($"{uri}{separator}v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
    }

    private static Uri BuildRemoteFileUri(string relativePath)
    {
        var normalizedPath = NormalizeManifestPath(relativePath);
        var escapedSegments = normalizedPath
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(Uri.EscapeDataString);
        return AppendCacheBust(new Uri(new Uri(ReleaseBaseUrl), string.Join("/", escapedSegments)));
    }

    private static void StopRunningDesktopInstances()
    {
        var currentProcessId = Environment.ProcessId;
        foreach (var process in Process.GetProcessesByName(InstalledProcessName))
        {
            if (process.Id == currentProcessId)
            {
                process.Dispose();
                continue;
            }

            try
            {
                if (!process.HasExited)
                {
                    process.CloseMainWindow();
                    if (!process.WaitForExit(2500))
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

    private static void StartInstalledApplication(string executablePath, string workingDirectory, bool background)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = executablePath,
            WorkingDirectory = workingDirectory,
            UseShellExecute = true
        };

        if (background)
        {
            startInfo.Arguments = "--background";
        }

        Process.Start(startInfo);
    }

    private static void TryStartInstalledApplication(string executablePath, string workingDirectory, bool background)
    {
        try
        {
            if (File.Exists(executablePath))
            {
                StartInstalledApplication(executablePath, workingDirectory, background);
            }
        }
        catch
        {
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
}

internal sealed record InstallOptions(bool SilentMode, bool ForceRemoteManifest, bool RestartInBackground)
{
    public static InstallOptions Parse(string[] args)
    {
        var silentMode = false;
        var forceRemoteManifest = false;
        var restartInBackground = false;

        foreach (var arg in args)
        {
            if (string.Equals(arg, "--silent-update", StringComparison.OrdinalIgnoreCase))
            {
                silentMode = true;
                forceRemoteManifest = true;
                continue;
            }

            if (string.Equals(arg, "--remote", StringComparison.OrdinalIgnoreCase))
            {
                forceRemoteManifest = true;
                continue;
            }

            if (string.Equals(arg, "--restart-background", StringComparison.OrdinalIgnoreCase))
            {
                restartInBackground = true;
            }
        }

        return new InstallOptions(silentMode, forceRemoteManifest, restartInBackground);
    }
}

internal sealed record ManifestSource(Uri Location, bool IsLocal, string? LocalManifestRoot);

internal sealed class DesktopPackageManifest
{
    public string GeneratedAtUtc { get; init; } = string.Empty;
    public List<DesktopPackageFile> Files { get; init; } = new();
}

internal sealed class DesktopPackageFile
{
    public string Path { get; init; } = string.Empty;
    public long Size { get; init; }
    public string Sha256 { get; init; } = string.Empty;
}
