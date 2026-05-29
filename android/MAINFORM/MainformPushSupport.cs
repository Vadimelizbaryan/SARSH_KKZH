using System.Text;
using System.Text.Json;
using Android.Content;
using Android.Provider;
using Firebase;
using Firebase.Messaging;

namespace MAINFORM;

internal static class MainformPushSupport
{
    private const string AndroidFirebaseConfigUrl =
        "https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram?action=android-firebase-config";
    private const string AndroidDeviceFcmRegisterUrl =
        "https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram?action=android-device-fcm-register";
    private const string PreferenceName = "mainform_preferences";
    private const string SelectedDepartmentKey = "selected_department_slug";
    private const string DeviceIdKey = "android_device_id";
    private const string AndroidIntakeHubDepartmentId = "admission_hub";
    private const string FcmTokenKey = "firebase_push_token";
    private const string FcmSyncedTokenKey = "firebase_push_synced_token";
    private const string FcmSyncedDepartmentIdKey = "firebase_push_synced_department_id";

    private static readonly HttpClient HttpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(30)
    };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly SemaphoreSlim InitLock = new(1, 1);

    private static AndroidFirebaseConfig? _cachedConfig;
    private static bool _firebaseInitialized;

    public static async Task InitializeAndRegisterAsync(Context context, string? departmentId)
    {
        var config = await EnsureFirebaseConfiguredAsync(context);
        if (config is null)
        {
            return;
        }

        var currentDepartmentId = NormalizeDepartmentId(departmentId) ?? GetSelectedDepartmentId(context);
        if (string.IsNullOrWhiteSpace(currentDepartmentId) ||
            string.Equals(currentDepartmentId, AndroidIntakeHubDepartmentId, StringComparison.Ordinal))
        {
            return;
        }

        var token = await FetchCurrentTokenAsync();
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        SaveCurrentToken(context, token);
        await RegisterTokenIfNeededAsync(context, currentDepartmentId, token);
    }

    public static async Task HandleNewTokenAsync(Context context, string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        SaveCurrentToken(context, token);
        var config = await EnsureFirebaseConfiguredAsync(context);
        if (config is null)
        {
            return;
        }

        var departmentId = GetSelectedDepartmentId(context);
        if (string.IsNullOrWhiteSpace(departmentId) ||
            string.Equals(departmentId, AndroidIntakeHubDepartmentId, StringComparison.Ordinal))
        {
            return;
        }

        await RegisterTokenIfNeededAsync(context, departmentId, token);
    }

    public static string? GetStoredToken(Context context)
    {
        return context.GetSharedPreferences(PreferenceName, FileCreationMode.Private)
            ?.GetString(FcmTokenKey, null)
            ?.Trim();
    }

    private static async Task<AndroidFirebaseConfig?> EnsureFirebaseConfiguredAsync(Context context)
    {
        if (_firebaseInitialized)
        {
            return _cachedConfig;
        }

        await InitLock.WaitAsync();
        try
        {
            if (_firebaseInitialized)
            {
                return _cachedConfig;
            }

            _cachedConfig ??= await FetchFirebaseConfigAsync();
            if (_cachedConfig is null || !_cachedConfig.Enabled)
            {
                return null;
            }

            var existingApps = FirebaseApp.GetApps(context);
            if (existingApps.Count == 0)
            {
                var builder = new FirebaseOptions.Builder()
                    .SetApplicationId(_cachedConfig.ApplicationId)
                    .SetProjectId(_cachedConfig.ProjectId)
                    .SetGcmSenderId(_cachedConfig.SenderId)
                    .SetApiKey(_cachedConfig.ApiKey);

                if (!string.IsNullOrWhiteSpace(_cachedConfig.StorageBucket))
                {
                    builder.SetStorageBucket(_cachedConfig.StorageBucket);
                }

                FirebaseApp.InitializeApp(context, builder.Build());
            }

            FirebaseMessaging.Instance.AutoInitEnabled = true;
            _firebaseInitialized = true;
            return _cachedConfig;
        }
        catch
        {
            return null;
        }
        finally
        {
            InitLock.Release();
        }
    }

    private static async Task<AndroidFirebaseConfig?> FetchFirebaseConfigAsync()
    {
        using var response = await HttpClient.GetAsync(AndroidFirebaseConfigUrl);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var responseStream = await response.Content.ReadAsStreamAsync();
        var payload = await JsonSerializer.DeserializeAsync<AndroidFirebaseConfigResponse>(responseStream, JsonOptions);
        if (payload is null || !payload.Ok || !payload.Enabled)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(payload.ProjectId) ||
            string.IsNullOrWhiteSpace(payload.ApplicationId) ||
            string.IsNullOrWhiteSpace(payload.SenderId) ||
            string.IsNullOrWhiteSpace(payload.ApiKey))
        {
            return null;
        }

        return new AndroidFirebaseConfig(
            payload.ProjectId.Trim(),
            payload.ApplicationId.Trim(),
            payload.SenderId.Trim(),
            payload.ApiKey.Trim(),
            string.IsNullOrWhiteSpace(payload.StorageBucket) ? null : payload.StorageBucket.Trim()
        );
    }

    private static async Task<string?> FetchCurrentTokenAsync()
    {
        try
        {
            var tokenTask = FirebaseMessaging.Instance.GetToken();
            var completion = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
            tokenTask.AddOnCompleteListener(new FirebaseTokenCompleteListener(completion));
            return await completion.Task;
        }
        catch
        {
            return null;
        }
    }

    private static void SaveCurrentToken(Context context, string token)
    {
        context.GetSharedPreferences(PreferenceName, FileCreationMode.Private)?
            .Edit()?
            .PutString(FcmTokenKey, token)?
            .Apply();
    }

    private static async Task RegisterTokenIfNeededAsync(Context context, string departmentId, string token)
    {
        var preferences = context.GetSharedPreferences(PreferenceName, FileCreationMode.Private);
        var syncedToken = preferences?.GetString(FcmSyncedTokenKey, null)?.Trim();
        var syncedDepartmentId = preferences?.GetString(FcmSyncedDepartmentIdKey, null)?.Trim();
        if (string.Equals(token, syncedToken, StringComparison.Ordinal) &&
            string.Equals(departmentId, syncedDepartmentId, StringComparison.Ordinal))
        {
            return;
        }

        var payload = new
        {
            deviceId = GetOrCreateDeviceId(context),
            deviceName = BuildDeviceName(),
            departmentId,
            fcmToken = token
        };

        var requestBody = JsonSerializer.Serialize(payload, JsonOptions);
        using var response = await HttpClient.PostAsync(
            AndroidDeviceFcmRegisterUrl,
            new StringContent(requestBody, Encoding.UTF8, "application/json")
        );
        if (!response.IsSuccessStatusCode)
        {
            return;
        }

        preferences?
            .Edit()?
            .PutString(FcmSyncedTokenKey, token)?
            .PutString(FcmSyncedDepartmentIdKey, departmentId)?
            .Apply();
    }

    private static string? GetSelectedDepartmentId(Context context)
    {
        var slug = context.GetSharedPreferences(PreferenceName, FileCreationMode.Private)
            ?.GetString(SelectedDepartmentKey, null)
            ?.Trim();
        return ResolveDepartmentIdFromSlug(slug);
    }

    private static string? ResolveDepartmentIdFromSlug(string? slug)
    {
        return slug switch
        {
            "te9625wg" => "r4",
            "1ei6dnv2" => "r5",
            "du9wa6oq" => "r6",
            "08xa44ew" => "r7",
            "v1914tm9" => "r8",
            "c3usp3r9" => "r9",
            "g5u3jca0" => "r10",
            "4k6uv2xu" => "r11",
            "ltndeohl" => "r12",
            "ptf9nvbv" => "r13",
            "9htuxle8" => "r14",
            "ldvp99z7" => "r15",
            "zzphaoqo" => "r16",
            "4zby7qi3" => "r17",
            "c5mv5bh4" => "r19",
            "5s7rrwg9" => "r20",
            "3ofsacp6" => "r21",
            AndroidIntakeHubDepartmentId => AndroidIntakeHubDepartmentId,
            _ => null
        };
    }

    private static string? NormalizeDepartmentId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        return normalized switch
        {
            "r4" or "r5" or "r6" or "r7" or "r8" or "r9" or "r10" or "r11" or "r12" or "r13" or
            "r14" or "r15" or "r16" or "r17" or "r19" or "r20" or "r21" or AndroidIntakeHubDepartmentId
                => normalized,
            _ => null
        };
    }

    private static string GetOrCreateDeviceId(Context context)
    {
        var androidId = Settings.Secure.GetString(context.ContentResolver, Settings.Secure.AndroidId);
        if (!string.IsNullOrWhiteSpace(androidId))
        {
            return androidId.Trim();
        }

        var preferences = context.GetSharedPreferences(PreferenceName, FileCreationMode.Private);
        var existing = preferences?.GetString(DeviceIdKey, null);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            return existing.Trim();
        }

        var generated = Guid.NewGuid().ToString("N");
        preferences?
            .Edit()?
            .PutString(DeviceIdKey, generated)?
            .Apply();
        return generated;
    }

    private static string BuildDeviceName()
    {
        var manufacturer = (global::Android.OS.Build.Manufacturer ?? string.Empty).Trim();
        var model = (global::Android.OS.Build.Model ?? string.Empty).Trim();
        var device = string.Join(
            " ",
            new[] { manufacturer, model }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ).Trim();

        return string.IsNullOrWhiteSpace(device) ? "Android MAINFORM" : device;
    }

    private sealed record AndroidFirebaseConfig(
        string ProjectId,
        string ApplicationId,
        string SenderId,
        string ApiKey,
        string? StorageBucket
    )
    {
        public bool Enabled => !string.IsNullOrWhiteSpace(ProjectId) &&
                               !string.IsNullOrWhiteSpace(ApplicationId) &&
                               !string.IsNullOrWhiteSpace(SenderId) &&
                               !string.IsNullOrWhiteSpace(ApiKey);
    }

    private sealed record AndroidFirebaseConfigResponse(
        bool Ok,
        bool Enabled,
        string? ProjectId,
        string? ApplicationId,
        string? SenderId,
        string? ApiKey,
        string? StorageBucket
    );

    private sealed class FirebaseTokenCompleteListener(TaskCompletionSource<string?> completion) :
        Java.Lang.Object,
        global::Android.Gms.Tasks.IOnCompleteListener
    {
        public void OnComplete(global::Android.Gms.Tasks.Task task)
        {
            if (task.IsSuccessful)
            {
                completion.TrySetResult(task.Result?.ToString()?.Trim());
                return;
            }

            completion.TrySetResult(null);
        }
    }
}
