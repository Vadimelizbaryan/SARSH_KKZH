namespace MAINFLOW.Desktop;

static class Program
{
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
        Application.Run(new Form1(startInBackground));
    }    
}
