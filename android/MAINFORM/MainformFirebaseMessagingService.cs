using Android;
using Android.App;
using Android.Content;
using Android.Content.PM;
using AndroidX.Core.App;
using AndroidX.Core.Content;
using Firebase.Messaging;

namespace MAINFORM;

[Service(Name = "com.sarsh.mainform.MainformFirebaseMessagingService", Exported = false)]
[IntentFilter(["com.google.firebase.MESSAGING_EVENT"])]
public class MainformFirebaseMessagingService : FirebaseMessagingService
{
    private const string NotificationChannelId = "mainform_ocr_results";

    public override void OnNewToken(string token)
    {
        base.OnNewToken(token);
        _ = MainformPushSupport.HandleNewTokenAsync(this, token);
    }

    public override void OnMessageReceived(RemoteMessage message)
    {
        base.OnMessageReceived(message);

        var title = message.GetNotification()?.Title
            ?? GetDataValue(message, "title")
            ?? "MAINFORM OCR";
        var body = message.GetNotification()?.Body
            ?? GetDataValue(message, "message")
            ?? string.Empty;
        var level = GetDataValue(message, "level") ?? "success";

        if (string.IsNullOrWhiteSpace(body))
        {
            return;
        }

        ShowNotification(this, title, body, level);
    }

    private static string? GetDataValue(RemoteMessage message, string key)
    {
        return message.Data is not null && message.Data.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }

    private static void ShowNotification(Context context, string title, string message, string level)
    {
        if (global::Android.OS.Build.VERSION.SdkInt >= global::Android.OS.BuildVersionCodes.Tiramisu &&
            ContextCompat.CheckSelfPermission(context, Manifest.Permission.PostNotifications) != Permission.Granted)
        {
            return;
        }

        var launchIntent = context.PackageManager?.GetLaunchIntentForPackage(context.PackageName);
        PendingIntent? pendingIntent = null;
        if (launchIntent is not null)
        {
            launchIntent.AddFlags(ActivityFlags.SingleTop | ActivityFlags.ClearTop);
            pendingIntent = PendingIntent.GetActivity(
                context,
                0,
                launchIntent,
                PendingIntentFlags.UpdateCurrent | PendingIntentFlags.Immutable
            );
        }

        var builder = new NotificationCompat.Builder(context, NotificationChannelId)
            .SetSmallIcon(Android.Resource.Drawable.IcDialogInfo)
            .SetContentTitle(title)
            .SetContentText(message)
            .SetStyle(new NotificationCompat.BigTextStyle().BigText(message))
            .SetPriority(level == "warning"
                ? NotificationCompat.PriorityHigh
                : NotificationCompat.PriorityDefault)
            .SetAutoCancel(true);

        if (pendingIntent is not null)
        {
            builder.SetContentIntent(pendingIntent);
        }

        NotificationManagerCompat.From(context).Notify(
            Environment.TickCount & int.MaxValue,
            builder.Build()
        );
    }
}
