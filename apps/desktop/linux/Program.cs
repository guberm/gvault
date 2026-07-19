using System.Diagnostics;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

try {
    if (args.Contains("--help") || args.Contains("-h")) {
        PrintHelp();
        return;
    }

    if (args.Contains("--login-smoke")) {
        await RunLoginSmokeAsync(args.ToList());
        return;
    }

    Console.WriteLine("GVault desktop preview");
    Console.WriteLine("Self-hosted password and identity vault.");
    Console.WriteLine("Open https://github.com/guberm/gvault for setup and server instructions.");
    Console.WriteLine("Run with --login-smoke to verify server-backed Linux login.");

    if (args.Contains("--open")) {
        var url = "https://github.com/guberm/gvault";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux)) {
            Process.Start("xdg-open", url);
        }
    }
} catch (Exception error) {
    Console.Error.WriteLine(error.Message);
    Environment.ExitCode = 1;
}

static async Task RunLoginSmokeAsync(List<string> args)
{
    var server = ReadOption(args, "--server") ?? Environment.GetEnvironmentVariable("GVAULT_SERVER_URL");
    var email = ReadOption(args, "--email") ?? Environment.GetEnvironmentVariable("GVAULT_EMAIL");
    var password = ReadOption(args, "--password") ?? Environment.GetEnvironmentVariable("GVAULT_PASSWORD");

    if (string.IsNullOrWhiteSpace(server)) throw new InvalidOperationException("Missing --server or GVAULT_SERVER_URL.");
    if (string.IsNullOrWhiteSpace(email)) throw new InvalidOperationException("Missing --email or GVAULT_EMAIL.");
    if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Missing --password or GVAULT_PASSWORD.");

    var endpoint = new Uri(NormalizeServerUrl(server), "api/auth/login");
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    var payload = JsonSerializer.Serialize(new { email, password, deviceName = "Linux desktop" });
    using var response = await client.PostAsync(endpoint, new StringContent(payload, Encoding.UTF8, "application/json"));
    var body = await response.Content.ReadAsStringAsync();

    if (!response.IsSuccessStatusCode) {
        throw new InvalidOperationException($"Login failed with HTTP {(int)response.StatusCode}: {body}");
    }

    using var document = JsonDocument.Parse(body);
    var root = document.RootElement;
    var hasToken = root.TryGetProperty("token", out var token) && !string.IsNullOrWhiteSpace(token.GetString());
    var hasUserId = root.TryGetProperty("userId", out var userId) && !string.IsNullOrWhiteSpace(userId.GetString());
    if (!hasToken || !hasUserId) {
        throw new InvalidOperationException("Login response did not include token and userId.");
    }

    Console.WriteLine($"GVault Linux login smoke ok for {email} at {endpoint.GetLeftPart(UriPartial.Authority)}");
}

static Uri NormalizeServerUrl(string server)
{
    var value = server.Trim();
    if (!value.EndsWith('/')) value += "/";
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) {
        throw new InvalidOperationException($"Invalid server URL: {server}");
    }
    return uri;
}

static string? ReadOption(List<string> args, string name)
{
    var index = args.IndexOf(name);
    if (index < 0 || index + 1 >= args.Count) return null;
    return args[index + 1];
}

static void PrintHelp()
{
    Console.WriteLine("GVault Linux client");
    Console.WriteLine("Usage:");
    Console.WriteLine("  GVault --login-smoke --server <url> --email <email> --password <password>");
    Console.WriteLine("Environment fallbacks: GVAULT_SERVER_URL, GVAULT_EMAIL, GVAULT_PASSWORD");
}
