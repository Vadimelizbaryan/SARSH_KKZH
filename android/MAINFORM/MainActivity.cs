using System.Net.Http;
using System.Text;
using System.Text.Json;
using Android.App;
using Android.Content;
using Android.Graphics;
using Android.OS;
using Android.Provider;
using Android.Views;
using Android.Webkit;
using Android.Widget;
using AndroidX.Core.Content;

namespace MAINFORM;

[Activity(Label = "@string/app_name", MainLauncher = true, Exported = true)]
public class MainActivity : Activity
{
    private const string AndroidFormBootstrapUrl =
        "https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram?action=android-form-url";
    private const string AndroidPhotoCheckUrl =
        "https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram?action=android-photo-check";
    private const string AndroidReleaseManifestUrl =
        "https://vadimelizbaryan.github.io/SARSH_KKZH/android/releases/latest.json";
    private const string PreferenceName = "mainform_preferences";
    private const string SelectedDepartmentKey = "selected_department_slug";
    private const string DeviceIdKey = "android_device_id";
    private const int FileChooserRequestCode = 1101;
    private const int NativePhotoRequestCode = 1102;
    private const int PhotoMaxDimension = 1600;
    private const int PhotoQuality = 86;

    private static readonly HttpClient BootstrapHttpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(45)
    };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly DepartmentOption[] Departments =
    [
        new("Վիրաբուժական", "te9625wg", "r4"),
        new("Դ/Ծ վ/բ բաժանմունք", "1ei6dnv2", "r5"),
        new("Քիթ-կոկորդ բ-ք", "du9wa6oq", "r6"),
        new("Ակնաբուժական", "08xa44ew", "r7"),
        new("Վնասվածքաբանական", "v1914tm9", "r8"),
        new("Կրծքային վ/բ", "c3usp3r9", "r9"),
        new("Ուռոլոգիական", "g5u3jca0", "r10"),
        new("Նեյրովիրաբուժական", "4k6uv2xu", "r11"),
        new("Թռիչքային", "ltndeohl", "r12"),
        new("Թերապիա", "ptf9nvbv", "r13"),
        new("Վերակենդանացման", "9htuxle8", "r14"),
        new("Նյարդաբանական", "ldvp99z7", "r15"),
        new("Գինեկոլոգիական", "zzphaoqo", "r16"),
        new("Անոթային", "4zby7qi3", "r17"),
        new("ԻՆՖ", "c5mv5bh4", "r19"),
        new("ԱՏԴ", "5s7rrwg9", "r20"),
        new("Ք/Հ", "3ofsacp6", "r21")
    ];

    private WebView? _webView;
    private TextView? _currentPageText;
    private ProgressBar? _progressBar;
    private Button? _photoButton;
    private Button? _clearPhotoButton;
    private TextView? _photoStatusText;
    private ImageView? _photoPreviewView;
    private ISharedPreferences? _preferences;
    private IValueCallback? _fileChooserCallback;
    private Android.Net.Uri? _pendingCameraUri;
    private bool _updatePromptShown;
    private bool _pageReady;
    private DepartmentOption? _selectedDepartment;
    private AndroidPhotoRuntimeState _photoState = AndroidPhotoRuntimeState.Empty;

    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        SetContentView(Resource.Layout.activity_main);

        _preferences = GetSharedPreferences(PreferenceName, FileCreationMode.Private);
        _webView = FindViewById<WebView>(Resource.Id.mainWebView);
        _currentPageText = FindViewById<TextView>(Resource.Id.textCurrentPage);
        _progressBar = FindViewById<ProgressBar>(Resource.Id.progressBar);
        _photoButton = FindViewById<Button>(Resource.Id.buttonPhoto);
        _clearPhotoButton = FindViewById<Button>(Resource.Id.buttonClearPhoto);
        _photoStatusText = FindViewById<TextView>(Resource.Id.textPhotoStatus);
        _photoPreviewView = FindViewById<ImageView>(Resource.Id.imagePhotoPreview);

        var selectDepartmentButton = FindViewById<Button>(Resource.Id.buttonSelectDepartment);
        var refreshButton = FindViewById<Button>(Resource.Id.buttonRefresh);

        ConfigureWebView();

        if (selectDepartmentButton is not null)
        {
            selectDepartmentButton.Click += (_, _) => ShowDepartmentPicker();
        }

        if (refreshButton is not null)
        {
            refreshButton.Click += (_, _) => _webView?.Reload();
        }

        if (_photoButton is not null)
        {
            _photoButton.Click += (_, _) => StartNativePhotoChooser();
        }

        if (_clearPhotoButton is not null)
        {
            _clearPhotoButton.Click += (_, _) => ClearSelectedPhoto(showToast: true);
        }

        RenderPhotoState();

        var selectedSlug = _preferences?.GetString(SelectedDepartmentKey, null);
        _selectedDepartment = Departments.FirstOrDefault(item => item.Slug == selectedSlug);
        if (_selectedDepartment is null)
        {
            if (_currentPageText is not null)
            {
                _currentPageText.Text = GetString(Resource.String.no_department_selected);
            }
            _ = CheckForAppUpdateAsync();
            ShowDepartmentPicker();
            return;
        }

        _ = LoadDepartmentFormAsync(_selectedDepartment, clearPhoto: false);
        _ = CheckForAppUpdateAsync();
    }

    public override void OnBackPressed()
    {
        if (_webView?.CanGoBack() == true)
        {
            _webView.GoBack();
            return;
        }

        base.OnBackPressed();
    }

    protected override async void OnActivityResult(int requestCode, Result resultCode, Intent? data)
    {
        base.OnActivityResult(requestCode, resultCode, data);

        if (requestCode == FileChooserRequestCode)
        {
            HandleWebFileChooserResult(resultCode, data);
            return;
        }

        if (requestCode != NativePhotoRequestCode)
        {
            return;
        }

        Android.Net.Uri? selectedUri = null;
        if (resultCode == Result.Ok)
        {
            selectedUri = data?.Data ?? _pendingCameraUri;
        }

        _pendingCameraUri = null;
        if (selectedUri is not null)
        {
            await ProcessNativePhotoAsync(selectedUri);
        }
    }

    private void ConfigureWebView()
    {
        if (_webView is null)
        {
            return;
        }

        var webSettings = _webView.Settings;
        webSettings.JavaScriptEnabled = true;
        webSettings.DomStorageEnabled = true;
        webSettings.AllowFileAccess = true;
        webSettings.AllowContentAccess = true;
        webSettings.DatabaseEnabled = true;
        webSettings.LoadWithOverviewMode = true;
        webSettings.UseWideViewPort = true;
        webSettings.BuiltInZoomControls = true;
        webSettings.DisplayZoomControls = false;
        webSettings.SetSupportZoom(true);
        webSettings.MediaPlaybackRequiresUserGesture = false;

        CookieManager.Instance.SetAcceptCookie(true);
        if (Build.VERSION.SdkInt >= BuildVersionCodes.Lollipop)
        {
            CookieManager.Instance.SetAcceptThirdPartyCookies(_webView, true);
        }

        _webView.SetWebViewClient(new MainFormWebViewClient(this));
        _webView.SetWebChromeClient(new MainFormWebChromeClient(this));
    }

    private void HandleWebFileChooserResult(Result resultCode, Intent? data)
    {
        Android.Net.Uri[]? results = null;

        if (resultCode == Result.Ok)
        {
            if (data?.ClipData is not null)
            {
                var itemCount = data.ClipData.ItemCount;
                results = new Android.Net.Uri[itemCount];
                for (var index = 0; index < itemCount; index += 1)
                {
                    results[index] = data.ClipData.GetItemAt(index).Uri!;
                }
            }
            else if (data?.Data is not null)
            {
                results = [data.Data];
            }
            else if (_pendingCameraUri is not null)
            {
                results = [_pendingCameraUri];
            }
        }

        _fileChooserCallback?.OnReceiveValue(results);
        _fileChooserCallback = null;
        _pendingCameraUri = null;
    }

    private void ShowDepartmentPicker()
    {
        var labels = Departments.Select(item => item.Name).ToArray();
        var selectedSlug = _preferences?.GetString(SelectedDepartmentKey, null);
        var selectedIndex = Array.FindIndex(Departments, item => item.Slug == selectedSlug);
        if (selectedIndex < 0)
        {
            selectedIndex = 0;
        }

        var pendingIndex = selectedIndex;
        new AlertDialog.Builder(this)
            .SetTitle(Resource.String.choose_department_title)
            .SetSingleChoiceItems(labels, selectedIndex, (_, args) =>
            {
                if (args.Which >= 0 && args.Which < Departments.Length)
                {
                    pendingIndex = args.Which;
                }
            })
            .SetPositiveButton(Resource.String.confirm_department, (_, _) =>
            {
                if (pendingIndex >= 0 && pendingIndex < Departments.Length)
                {
                    _ = LoadDepartmentFormAsync(Departments[pendingIndex], clearPhoto: true);
                }
            })
            .SetNegativeButton(Android.Resource.String.Cancel, (_, _) => { })
            .Show();
    }

    private void SaveSelectedDepartment(string slug)
    {
        _preferences?
            .Edit()?
            .PutString(SelectedDepartmentKey, slug)?
            .Apply();
    }

    private async Task LoadDepartmentFormAsync(DepartmentOption option, bool clearPhoto)
    {
        _selectedDepartment = option;
        SaveSelectedDepartment(option.Slug);
        if (clearPhoto)
        {
            ClearSelectedPhoto(showToast: false);
        }

        RunOnUiThread(() =>
        {
            if (_currentPageText is not null)
            {
                _currentPageText.Text = GetString(Resource.String.loading_department_form, option.Name);
            }
            UpdateProgress(10);
        });

        try
        {
            var formUrl = await FetchDepartmentFormUrlAsync(option.DepartmentId);
            RunOnUiThread(() =>
            {
                _pageReady = false;
                if (_currentPageText is not null)
                {
                    _currentPageText.Text = GetString(Resource.String.loading_department, option.Name);
                }
                _webView?.LoadUrl(formUrl);
            });
        }
        catch (Exception error)
        {
            RunOnUiThread(() =>
            {
                UpdateProgress(0);
                var message = string.IsNullOrWhiteSpace(error.Message)
                    ? GetString(Resource.String.department_form_load_failed)
                    : error.Message;
                if (_currentPageText is not null)
                {
                    _currentPageText.Text = message;
                }
                Toast.MakeText(this, message, ToastLength.Long)?.Show();
            });
        }
    }

    private async Task<string> FetchDepartmentFormUrlAsync(string departmentId)
    {
        var requestUrl =
            $"{AndroidFormBootstrapUrl}&departmentId={Uri.EscapeDataString(departmentId)}" +
            $"&deviceId={Uri.EscapeDataString(GetOrCreateDeviceId())}" +
            $"&deviceName={Uri.EscapeDataString(BuildDeviceName())}";
        using var response = await BootstrapHttpClient.GetAsync(requestUrl);
        var responseText = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            var bootstrapError = TryGetBootstrapMessage(responseText);
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(bootstrapError)
                    ? GetString(Resource.String.department_form_load_failed)
                    : bootstrapError
            );
        }

        using var json = JsonDocument.Parse(responseText);
        var root = json.RootElement;
        var isOk = root.TryGetProperty("ok", out var okElement) &&
                   okElement.ValueKind == JsonValueKind.True;

        if (!isOk)
        {
            var bootstrapError = TryGetBootstrapMessage(responseText);
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(bootstrapError)
                    ? GetString(Resource.String.department_form_load_failed)
                    : bootstrapError
            );
        }

        var formUrl = root.TryGetProperty("url", out var urlElement) &&
                      urlElement.ValueKind == JsonValueKind.String
            ? urlElement.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(formUrl))
        {
            throw new InvalidOperationException(GetString(Resource.String.department_form_invalid_response));
        }

        return formUrl;
    }

    private void StartNativePhotoChooser()
    {
        if (_selectedDepartment is null)
        {
            Toast.MakeText(this, Resource.String.select_department_first, ToastLength.Short)?.Show();
            return;
        }

        var contentIntent = new Intent(Intent.ActionGetContent);
        contentIntent.AddCategory(Intent.CategoryOpenable);
        contentIntent.SetType("image/*");

        var captureIntent = CreateCameraIntent();
        var initialIntents = captureIntent is null ? Array.Empty<Intent>() : [captureIntent];

        var chooserIntent = Intent.CreateChooser(contentIntent, GetString(Resource.String.choose_image));
        chooserIntent.PutExtra(Intent.ExtraInitialIntents, initialIntents);

        StartActivityForResult(chooserIntent, NativePhotoRequestCode);
    }

    private async Task ProcessNativePhotoAsync(Android.Net.Uri sourceUri)
    {
        if (_selectedDepartment is null)
        {
            Toast.MakeText(this, Resource.String.select_department_first, ToastLength.Short)?.Show();
            return;
        }

        SetPhotoStatus(GetString(Resource.String.photo_checking), "#8A4A00");

        try
        {
            var preparedPhoto = await PreparePhotoPayloadAsync(sourceUri, _selectedDepartment.DepartmentId);
            var result = await CheckDepartmentPhotoAsync(_selectedDepartment.DepartmentId, preparedPhoto);

            _photoState = new AndroidPhotoRuntimeState(
                Exists: true,
                Matched: result.Matched,
                ImageDataUrl: result.ImageDataUrl,
                ImageName: result.ImageName,
                DetectedDepartmentId: result.DetectedDepartmentId,
                Message: result.Message
            );

            RunOnUiThread(() =>
            {
                RenderPhotoState();
                ApplyAndroidRuntimeStateToWebView();
            });
        }
        catch (Exception error)
        {
            _photoState = AndroidPhotoRuntimeState.Empty;
            RunOnUiThread(() =>
            {
                RenderPhotoState();
                var message = string.IsNullOrWhiteSpace(error.Message)
                    ? GetString(Resource.String.photo_processing_failed)
                    : error.Message;
                SetPhotoStatus(message, "#B92D20");
                ApplyAndroidRuntimeStateToWebView();
            });
        }
    }

    private async Task<PreparedPhotoPayload> PreparePhotoPayloadAsync(Android.Net.Uri sourceUri, string departmentId)
    {
        await using var boundsStream = ContentResolver?.OpenInputStream(sourceUri)
            ?? throw new InvalidOperationException(GetString(Resource.String.photo_processing_failed));
        var boundsOptions = new BitmapFactory.Options { InJustDecodeBounds = true };
        BitmapFactory.DecodeStream(boundsStream, null, boundsOptions);

        var decodeOptions = new BitmapFactory.Options
        {
            InSampleSize = CalculateInSampleSize(boundsOptions, PhotoMaxDimension, PhotoMaxDimension)
        };

        await using var decodeStream = ContentResolver?.OpenInputStream(sourceUri)
            ?? throw new InvalidOperationException(GetString(Resource.String.photo_processing_failed));
        using var decodedBitmap = BitmapFactory.DecodeStream(decodeStream, null, decodeOptions)
            ?? throw new InvalidOperationException(GetString(Resource.String.photo_processing_failed));

        using var scaledBitmap = ScaleBitmapIfNeeded(decodedBitmap, PhotoMaxDimension);
        using var memoryStream = new MemoryStream();
        scaledBitmap.Compress(Bitmap.CompressFormat.Jpeg, PhotoQuality, memoryStream);
        var bytes = memoryStream.ToArray();
        var imageDataUrl = $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}";

        var fileName = BuildPhotoFileName(sourceUri, departmentId);
        return new PreparedPhotoPayload(fileName, imageDataUrl);
    }

    private static int CalculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight)
    {
        var inSampleSize = 1;
        var height = options.OutHeight;
        var width = options.OutWidth;

        while (height / inSampleSize > reqHeight * 2 || width / inSampleSize > reqWidth * 2)
        {
            inSampleSize *= 2;
        }

        return Math.Max(1, inSampleSize);
    }

    private static Bitmap ScaleBitmapIfNeeded(Bitmap bitmap, int maxDimension)
    {
        var width = bitmap.Width;
        var height = bitmap.Height;
        if (width <= maxDimension && height <= maxDimension)
        {
            return (Bitmap)bitmap.Copy(bitmap.GetConfig() ?? Bitmap.Config.Argb8888, false);
        }

        var ratio = Math.Min((float)maxDimension / width, (float)maxDimension / height);
        var targetWidth = Math.Max(1, (int)Math.Round(width * ratio));
        var targetHeight = Math.Max(1, (int)Math.Round(height * ratio));
        return Bitmap.CreateScaledBitmap(bitmap, targetWidth, targetHeight, true);
    }

    private string BuildPhotoFileName(Android.Net.Uri sourceUri, string departmentId)
    {
        var fallback = $"{departmentId}-{DateTime.UtcNow:yyyyMMddHHmmss}.jpg";
        var candidate = sourceUri.LastPathSegment;
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return fallback;
        }

        var sanitized = candidate
            .Replace("/", "_", StringComparison.Ordinal)
            .Replace("\\", "_", StringComparison.Ordinal)
            .Trim();
        if (string.IsNullOrWhiteSpace(sanitized))
        {
            return fallback;
        }

        if (!sanitized.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) &&
            !sanitized.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            sanitized += ".jpg";
        }

        return sanitized;
    }

    private async Task<AndroidPhotoCheckResult> CheckDepartmentPhotoAsync(string departmentId, PreparedPhotoPayload payload)
    {
        var requestBody = JsonSerializer.Serialize(new
        {
            departmentId,
            androidDeviceId = GetOrCreateDeviceId(),
            androidDeviceName = BuildDeviceName(),
            imageName = payload.ImageName,
            imageDataUrl = payload.ImageDataUrl
        }, JsonOptions);

        using var response = await BootstrapHttpClient.PostAsync(
            AndroidPhotoCheckUrl,
            new StringContent(requestBody, Encoding.UTF8, "application/json")
        );
        var responseText = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            var bootstrapError = TryGetBootstrapMessage(responseText);
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(bootstrapError)
                    ? GetString(Resource.String.photo_processing_failed)
                    : bootstrapError
            );
        }

        using var json = JsonDocument.Parse(responseText);
        var root = json.RootElement;
        var isOk = root.TryGetProperty("ok", out var okElement) && okElement.ValueKind == JsonValueKind.True;
        if (!isOk)
        {
            var bootstrapError = TryGetBootstrapMessage(responseText);
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(bootstrapError)
                    ? GetString(Resource.String.photo_processing_failed)
                    : bootstrapError
            );
        }

        var matched = root.TryGetProperty("matched", out var matchedElement) &&
                      matchedElement.ValueKind == JsonValueKind.True;
        var imageDataUrl = root.TryGetProperty("normalizedImageDataUrl", out var imageDataElement) &&
                           imageDataElement.ValueKind == JsonValueKind.String
            ? imageDataElement.GetString() ?? payload.ImageDataUrl
            : payload.ImageDataUrl;
        var imageName = root.TryGetProperty("normalizedImageName", out var imageNameElement) &&
                        imageNameElement.ValueKind == JsonValueKind.String
            ? imageNameElement.GetString() ?? payload.ImageName
            : payload.ImageName;
        var detectedDepartmentId = root.TryGetProperty("detectedDepartmentId", out var detectedElement) &&
                                   detectedElement.ValueKind == JsonValueKind.String
            ? detectedElement.GetString()
            : string.Empty;
        var message = root.TryGetProperty("message", out var messageElement) &&
                      messageElement.ValueKind == JsonValueKind.String
            ? messageElement.GetString()
            : null;

        return new AndroidPhotoCheckResult(
            Matched: matched,
            ImageDataUrl: imageDataUrl,
            ImageName: imageName,
            DetectedDepartmentId: detectedDepartmentId ?? string.Empty,
            Message: string.IsNullOrWhiteSpace(message)
                ? matched ? GetString(Resource.String.photo_ready) : GetString(Resource.String.photo_match_failed)
                : message
        );
    }

    private void ClearSelectedPhoto(bool showToast)
    {
        _photoState = AndroidPhotoRuntimeState.Empty;
        RenderPhotoState();
        ApplyAndroidRuntimeStateToWebView();
        if (showToast)
        {
            Toast.MakeText(this, Resource.String.photo_cleared, ToastLength.Short)?.Show();
        }
    }

    private void RenderPhotoState()
    {
        if (_photoPreviewView is null || _photoStatusText is null || _clearPhotoButton is null)
        {
            return;
        }

        if (_photoState.Exists && !string.IsNullOrWhiteSpace(_photoState.ImageDataUrl))
        {
            try
            {
                var bitmap = DecodeDataUrlBitmap(_photoState.ImageDataUrl);
                _photoPreviewView.SetImageBitmap(bitmap);
                _photoPreviewView.Visibility = ViewStates.Visible;
            }
            catch
            {
                _photoPreviewView.SetImageDrawable(null);
                _photoPreviewView.Visibility = ViewStates.Gone;
            }
        }
        else
        {
            _photoPreviewView.SetImageDrawable(null);
            _photoPreviewView.Visibility = ViewStates.Gone;
        }

        _clearPhotoButton.Enabled = _photoState.Exists;

        if (!_photoState.Exists)
        {
            SetPhotoStatus(GetString(Resource.String.photo_not_selected), "#8A4A00");
            return;
        }

        SetPhotoStatus(
            string.IsNullOrWhiteSpace(_photoState.Message)
                ? (_photoState.Matched ? GetString(Resource.String.photo_ready) : GetString(Resource.String.photo_match_failed))
                : _photoState.Message,
            _photoState.Matched ? "#0F8B4C" : "#B92D20"
        );
    }

    private void SetPhotoStatus(string message, string colorHex)
    {
        if (_photoStatusText is null)
        {
            return;
        }

        _photoStatusText.Text = message;
        try
        {
            _photoStatusText.SetTextColor(Color.ParseColor(colorHex));
        }
        catch
        {
            _photoStatusText.SetTextColor(Color.ParseColor("#2E2E2E"));
        }
    }

    private static Bitmap DecodeDataUrlBitmap(string dataUrl)
    {
        var commaIndex = dataUrl.IndexOf(',');
        var base64 = commaIndex >= 0 ? dataUrl[(commaIndex + 1)..] : dataUrl;
        var bytes = Convert.FromBase64String(base64);
        return BitmapFactory.DecodeByteArray(bytes, 0, bytes.Length)
            ?? throw new InvalidOperationException("Invalid image.");
    }

    private async Task CheckForAppUpdateAsync()
    {
        if (_updatePromptShown)
        {
            return;
        }

        try
        {
            using var response = await BootstrapHttpClient.GetAsync(AndroidReleaseManifestUrl);
            if (!response.IsSuccessStatusCode)
            {
                return;
            }

            var responseText = await response.Content.ReadAsStringAsync();
            using var json = JsonDocument.Parse(responseText);
            var root = json.RootElement;
            var latestVersionCode = root.TryGetProperty("versionCode", out var versionCodeElement) &&
                                    versionCodeElement.TryGetInt64(out var parsedVersionCode)
                ? parsedVersionCode
                : 0L;
            var latestVersionName = root.TryGetProperty("versionName", out var versionNameElement) &&
                                    versionNameElement.ValueKind == JsonValueKind.String
                ? versionNameElement.GetString()
                : null;
            var apkUrl = root.TryGetProperty("apkUrl", out var apkUrlElement) &&
                         apkUrlElement.ValueKind == JsonValueKind.String
                ? apkUrlElement.GetString()
                : null;

            if (latestVersionCode <= 0 || string.IsNullOrWhiteSpace(apkUrl))
            {
                return;
            }

            var packageInfo = PackageManager.GetPackageInfo(PackageName, 0);
            var currentVersionCode = Build.VERSION.SdkInt >= BuildVersionCodes.P
                ? packageInfo.LongVersionCode
                : packageInfo.VersionCode;
            var currentVersionName = packageInfo.VersionName ?? "1.0";

            if (latestVersionCode <= currentVersionCode)
            {
                return;
            }

            _updatePromptShown = true;
            RunOnUiThread(() =>
            {
                new AlertDialog.Builder(this)
                    .SetTitle(Resource.String.update_available_title)
                    .SetMessage(
                        GetString(
                            Resource.String.update_available_message,
                            currentVersionName,
                            latestVersionName ?? latestVersionCode.ToString()
                        )
                    )
                    .SetPositiveButton(Resource.String.update_now, (_, _) => OpenExternalUrl(apkUrl))
                    .SetNegativeButton(Resource.String.update_later, (_, _) => { })
                    .Show();
            });
        }
        catch
        {
            // Ignore transient network errors.
        }
    }

    private string GetOrCreateDeviceId()
    {
        var androidId = Settings.Secure.GetString(ContentResolver, Settings.Secure.AndroidId);
        if (!string.IsNullOrWhiteSpace(androidId))
        {
            return androidId.Trim();
        }

        var existing = _preferences?.GetString(DeviceIdKey, null);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            return existing.Trim();
        }

        var generated = Guid.NewGuid().ToString("N");
        _preferences?
            .Edit()?
            .PutString(DeviceIdKey, generated)?
            .Apply();
        return generated;
    }

    private static string BuildDeviceName()
    {
        var manufacturer = (Android.OS.Build.Manufacturer ?? string.Empty).Trim();
        var model = (Android.OS.Build.Model ?? string.Empty).Trim();
        var device = string.Join(
            " ",
            new[] { manufacturer, model }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ).Trim();

        return string.IsNullOrWhiteSpace(device) ? "Android MAINFORM" : device;
    }

    private static string? TryGetBootstrapMessage(string? responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText))
        {
            return null;
        }

        try
        {
            using var json = JsonDocument.Parse(responseText);
            var root = json.RootElement;
            if (root.TryGetProperty("message", out var messageElement) &&
                messageElement.ValueKind == JsonValueKind.String)
            {
                return messageElement.GetString();
            }

            if (root.TryGetProperty("error", out var errorElement) &&
                errorElement.ValueKind == JsonValueKind.String)
            {
                return errorElement.GetString();
            }
        }
        catch
        {
            // Ignore invalid JSON.
        }

        return null;
    }

    private void OpenExternalUrl(string? targetUrl)
    {
        if (string.IsNullOrWhiteSpace(targetUrl))
        {
            return;
        }

        try
        {
            StartActivity(new Intent(Intent.ActionView, Android.Net.Uri.Parse(targetUrl)));
        }
        catch
        {
            Toast.MakeText(this, Resource.String.update_open_failed, ToastLength.Long)?.Show();
        }
    }

    internal void UpdateProgress(int progress)
    {
        if (_progressBar is null)
        {
            return;
        }

        _progressBar.Progress = progress;
        _progressBar.Visibility = progress is > 0 and < 100
            ? ViewStates.Visible
            : ViewStates.Gone;
    }

    internal void OnPageFinished(string? url)
    {
        _pageReady = true;
        UpdateProgress(100);
        if (_selectedDepartment is not null && _currentPageText is not null)
        {
            _currentPageText.Text = GetString(Resource.String.loading_department, _selectedDepartment.Name);
        }
        ApplyAndroidRuntimeStateToWebView();
    }

    internal void ApplyAndroidRuntimeStateToWebView()
    {
        if (_webView is null || !_pageReady)
        {
            return;
        }

        var runtimeState = new
        {
            deviceId = GetOrCreateDeviceId(),
            deviceName = BuildDeviceName(),
            departmentId = _selectedDepartment?.DepartmentId ?? string.Empty,
            photo = new
            {
                exists = _photoState.Exists,
                matched = _photoState.Matched,
                imageDataUrl = _photoState.ImageDataUrl ?? string.Empty,
                imageName = _photoState.ImageName ?? string.Empty,
                detectedDepartmentId = _photoState.DetectedDepartmentId ?? string.Empty,
                message = _photoState.Message ?? string.Empty
            }
        };
        var json = JsonSerializer.Serialize(runtimeState, JsonOptions);
        var script = $"(function(){{window.MAINFORM_ANDROID={json};window.dispatchEvent(new CustomEvent('mainform-android-state-changed',{{detail:window.MAINFORM_ANDROID}}));}})();";
        try
        {
            _webView.EvaluateJavascript(script, null);
        }
        catch
        {
            // Ignore transient WebView timing errors.
        }
    }

    internal bool StartFileChooser(IValueCallback? callback)
    {
        _fileChooserCallback?.OnReceiveValue(null);
        _fileChooserCallback = callback;

        var contentIntent = new Intent(Intent.ActionGetContent);
        contentIntent.AddCategory(Intent.CategoryOpenable);
        contentIntent.SetType("image/*");

        var captureIntent = CreateCameraIntent();
        var initialIntents = captureIntent is null ? Array.Empty<Intent>() : [captureIntent];

        var chooserIntent = Intent.CreateChooser(contentIntent, GetString(Resource.String.choose_image));
        chooserIntent.PutExtra(Intent.ExtraInitialIntents, initialIntents);

        StartActivityForResult(chooserIntent, FileChooserRequestCode);
        return true;
    }

    private Intent? CreateCameraIntent()
    {
        var intent = new Intent(MediaStore.ActionImageCapture);
        if (intent.ResolveActivity(PackageManager) is null)
        {
            return null;
        }

        try
        {
            var imageFile = Java.IO.File.CreateTempFile("mainform_", ".jpg", CacheDir);
            var authority = $"{PackageName}.fileprovider";
            var imageUri = FileProvider.GetUriForFile(this, authority, imageFile);
            _pendingCameraUri = imageUri;

            intent.PutExtra(MediaStore.ExtraOutput, imageUri);
            intent.AddFlags(ActivityFlags.GrantReadUriPermission | ActivityFlags.GrantWriteUriPermission);

            var handlers = PackageManager.QueryIntentActivities(intent, Android.Content.PM.PackageInfoFlags.MatchDefaultOnly);
            foreach (var handler in handlers)
            {
                GrantUriPermission(
                    handler.ActivityInfo!.PackageName,
                    imageUri,
                    ActivityFlags.GrantReadUriPermission | ActivityFlags.GrantWriteUriPermission
                );
            }

            return intent;
        }
        catch
        {
            _pendingCameraUri = null;
            return null;
        }
    }

    private sealed class MainFormWebViewClient(MainActivity activity) : WebViewClient
    {
        public override bool ShouldOverrideUrlLoading(WebView? view, IWebResourceRequest? request)
        {
            var targetUrl = request?.Url?.ToString();
            if (string.IsNullOrWhiteSpace(targetUrl))
            {
                return false;
            }

            if (targetUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                targetUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            try
            {
                activity.StartActivity(new Intent(Intent.ActionView, Android.Net.Uri.Parse(targetUrl)));
                return true;
            }
            catch
            {
                return true;
            }
        }

        public override void OnPageFinished(WebView? view, string? url)
        {
            base.OnPageFinished(view, url);
            activity.OnPageFinished(url);
        }
    }

    private sealed class MainFormWebChromeClient(MainActivity activity) : WebChromeClient
    {
        public override bool OnShowFileChooser(
            WebView? webView,
            IValueCallback? filePathCallback,
            FileChooserParams? fileChooserParams
        )
        {
            return activity.StartFileChooser(filePathCallback);
        }

        public override void OnProgressChanged(WebView? view, int newProgress)
        {
            activity.UpdateProgress(newProgress);
            base.OnProgressChanged(view, newProgress);
        }
    }

    private sealed record DepartmentOption(string Name, string Slug, string DepartmentId);

    private sealed record PreparedPhotoPayload(string ImageName, string ImageDataUrl);

    private sealed record AndroidPhotoCheckResult(
        bool Matched,
        string ImageDataUrl,
        string ImageName,
        string DetectedDepartmentId,
        string Message
    );

    private sealed record AndroidPhotoRuntimeState(
        bool Exists,
        bool Matched,
        string? ImageDataUrl,
        string? ImageName,
        string? DetectedDepartmentId,
        string? Message
    )
    {
        public static AndroidPhotoRuntimeState Empty => new(false, false, null, null, null, null);
    }
}
