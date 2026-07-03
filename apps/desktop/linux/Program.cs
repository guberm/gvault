using System.Diagnostics;
using System.Runtime.InteropServices;

Console.WriteLine("GVault desktop preview");
Console.WriteLine("Self-hosted password and identity vault.");
Console.WriteLine("Open https://github.com/guberm/gvault for setup and server instructions.");

if (args.Contains("--open")) {
    var url = "https://github.com/guberm/gvault";
    if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux)) {
        Process.Start("xdg-open", url);
    }
}
