using Android.App;
using Android.Content;
using Android.OS;
using Android.Provider;
using Android.Webkit;
using Android.Widget;
using AndroidX.Core.Content;

namespace MAINFORM;

[Activity(Label = "@string/app_name", MainLauncher = true, Exported = true)]
public class MainActivity : Activity
{
    private const string BaseSiteUrl = "https://vadimelizbaryan.github.io/SARSH_KKZH/";
    private const string MainPageUrl = BaseSiteUrl + "index.html";
    private const string DepartmentBaseUrl = BaseSiteUrl + "bgej6lyx/";
    private const string PreferenceName = "mainform_preferences";
    private const string SelectedDepartmentKey = "selected_department_slug";
    private const int FileChooserRequestCode = 1101;

    private static readonly DepartmentOption[] Departments =
    [
        new("Վիրաբուժական", "te9625wg"),
        new("Դ/Ծ վ/բ բաժանմունք", "1ei6dnv2"),
        new("Քիթ-կոկորդ բ-ք", "du9wa6oq"),
        new("Ակնաբուժական", "08xa44ew"),
        new("Վնասվածքաբանական", "v1914tm9"),
        new("Կրծքային վ/բ", "c3usp3r9"),
        new("Ուռոլոգիական", "g5u3jca0"),
        new("Նեյրովիրաբուժական", "4k6uv2xu"),
        new("Թռիչքային", "ltndeohl"),
        new("Թերապիա", "ptf9nvbv"),
        new("Վերակենդանացման", "9htuxle8"),
        new("Նյարդաբանական", "ldvp99z7"),
        new("Գինեկոլոգիական", "zzphaoqo"),
        new("Անոթային", "4zby7qi3"),
        new("ԻՆՖ", "c5mv5bh4"),
        new("ԱՏԴ", "5s7rrwg9"),
        new("Ք/Հ", "3ofsacp6")
    ];

    private WebView? _webView;
    private TextView? _currentPageText;
    private ProgressBar? _progressBar;
    private ISharedPreferences? _preferences;
    private IValueCallback? _fileChooserCallback;
    private Android.Net.Uri? _pendingCameraUri;

    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        SetContentView(Resource.Layout.activity_main);

        _preferences = GetSharedPreferences(PreferenceName, FileCreationMode.Private);
        _webView = FindViewById<WebView>(Resource.Id.mainWebView);
        _currentPageText = FindViewById<TextView>(Resource.Id.textCurrentPage);
        _progressBar = FindViewById<ProgressBar>(Resource.Id.progressBar);

        var selectDepartmentButton = FindViewById<Button>(Resource.Id.buttonSelectDepartment);
        var mainPageButton = FindViewById<Button>(Resource.Id.buttonOpenMain);
        var refreshButton = FindViewById<Button>(Resource.Id.buttonRefresh);

        ConfigureWebView();

        if (selectDepartmentButton is not null)
        {
            selectDepartmentButton.Click += (_, _) => ShowDepartmentPicker();
        }

        if (mainPageButton is not null)
        {
            mainPageButton.Click += (_, _) => OpenMainPage();
        }

        if (refreshButton is not null)
        {
            refreshButton.Click += (_, _) => _webView?.Reload();
        }

        var selectedSlug = _preferences?.GetString(SelectedDepartmentKey, null);
        if (string.IsNullOrWhiteSpace(selectedSlug))
        {
            OpenMainPage();
            ShowDepartmentPicker();
        }
        else
        {
            LoadDepartmentPage(selectedSlug);
        }
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

    protected override void OnActivityResult(int requestCode, Result resultCode, Intent? data)
    {
        base.OnActivityResult(requestCode, resultCode, data);

        if (requestCode != FileChooserRequestCode)
        {
            return;
        }

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

    private void ShowDepartmentPicker()
    {
        var labels = Departments.Select(item => item.Name).ToArray();
        var selectedIndex = Array.FindIndex(
            Departments,
            item => item.Slug == _preferences?.GetString(SelectedDepartmentKey, null)
        );
        if (selectedIndex < 0)
        {
            selectedIndex = 0;
        }

        new AlertDialog.Builder(this)
            .SetTitle(Resource.String.choose_department_title)
            .SetSingleChoiceItems(labels, selectedIndex, (_, args) =>
            {
                if (args.Which >= 0 && args.Which < Departments.Length)
                {
                    SaveSelectedDepartment(Departments[args.Which].Slug);
                    LoadDepartmentPage(Departments[args.Which].Slug);
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

    private void LoadDepartmentPage(string slug)
    {
        var option = Departments.FirstOrDefault(item => item.Slug == slug);
        var url = $"{DepartmentBaseUrl}{slug}.html";
        _currentPageText!.Text = GetString(Resource.String.loading_department, option?.Name ?? slug);
        _webView?.LoadUrl(url);
    }

    private void OpenMainPage()
    {
        _currentPageText!.Text = GetString(Resource.String.loading_main_page);
        _webView?.LoadUrl(MainPageUrl);
    }

    internal void UpdateProgress(int progress)
    {
        if (_progressBar is null)
        {
            return;
        }

        _progressBar.Progress = progress;
        _progressBar.Visibility = progress is > 0 and < 100
            ? Android.Views.ViewStates.Visible
            : Android.Views.ViewStates.Gone;
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

    private sealed record DepartmentOption(string Name, string Slug);
}
