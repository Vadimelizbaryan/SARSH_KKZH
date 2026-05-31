namespace MAINFLOW.Desktop;

static class Program
{
    private const string AppMutexName = @"Local\SHARSH_AI_MAINFLOW_DESKTOP_SINGLE_INSTANCE";
    private const string RestoreEventName = @"Local\SHARSH_AI_MAINFLOW_DESKTOP_RESTORE";

    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static void Main(string[] args)
    {
        // To customize application configuration such as set high DPI settings or default font,
        // see https://aka.ms/applicationconfiguration.
        ApplicationConfiguration.Initialize();
        var startInBackground = args.Any(arg => string.Equals(arg, "--background", StringComparison.OrdinalIgnoreCase));
        using var singleInstanceMutex = new Mutex(initiallyOwned: true, AppMutexName, out var isPrimaryInstance);
        if (!isPrimaryInstance)
        {
            TrySignalRestoreExistingInstance();
            return;
        }

        using var restoreRequestEvent = new EventWaitHandle(
            initialState: false,
            mode: EventResetMode.AutoReset,
            name: RestoreEventName
        );

        Application.Run(new Form1(startInBackground, restoreRequestEvent));
        GC.KeepAlive(singleInstanceMutex);
    }

    private static void TrySignalRestoreExistingInstance()
    {
        try
        {
            using var restoreEvent = EventWaitHandle.OpenExisting(RestoreEventName);
            restoreEvent.Set();
        }
        catch
        {
        }
    }    
}
