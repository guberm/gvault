using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

if (args.Contains("--login-smoke"))
{
    try
    {
        await RunLoginSmokeAsync(args.ToList());
    }
    catch (Exception error)
    {
        Console.Error.WriteLine(error.Message);
        var evidencePath = ReadOption(args.ToList(), "--evidence");
        if (!string.IsNullOrWhiteSpace(evidencePath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(evidencePath))!);
            await File.WriteAllTextAsync(evidencePath, error.Message + Environment.NewLine, Encoding.UTF8);
        }
        Environment.ExitCode = 1;
    }
    return;
}

ApplicationConfiguration.Initialize();
var themePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "GVault", "theme.txt");
var darkMode = File.Exists(themePath) && File.ReadAllText(themePath).Trim() == "dark";

var form = new Form
{
    Text = "GVault",
    Width = 720,
    Height = 520,
    MinimumSize = new Size(640, 460),
    StartPosition = FormStartPosition.CenterScreen,
    BackColor = Color.FromArgb(244, 247, 249)
};

var title = new Label
{
    Text = "GVault",
    Font = new Font("Segoe UI", 26, FontStyle.Bold),
    ForeColor = Color.FromArgb(16, 32, 39),
    AutoSize = true,
    Location = new Point(28, 24)
};

var subtitle = new Label
{
    Text = "Self-hosted password and identity vault desktop client",
    Font = new Font("Segoe UI", 11, FontStyle.Regular),
    ForeColor = Color.FromArgb(99, 114, 122),
    AutoSize = true,
    Location = new Point(32, 70)
};

var statusPanel = new Panel
{
    BackColor = Color.White,
    BorderStyle = BorderStyle.FixedSingle,
    Location = new Point(32, 112),
    Size = new Size(640, 104)
};

var statusTitle = new Label
{
    Text = "Client status",
    Font = new Font("Segoe UI", 12, FontStyle.Bold),
    ForeColor = Color.FromArgb(16, 32, 39),
    AutoSize = true,
    Location = new Point(16, 14)
};

var statusText = new Label
{
    Text = "Native encrypted sync and OS keychain unlock are prepared as the next desktop milestone. Use the local web vault for the complete vault workflow in this release.",
    Font = new Font("Segoe UI", 10, FontStyle.Regular),
    ForeColor = Color.FromArgb(99, 114, 122),
    Width = 590,
    Height = 48,
    Location = new Point(16, 46)
};

statusPanel.Controls.Add(statusTitle);
statusPanel.Controls.Add(statusText);

var checklist = new ListBox
{
    Font = new Font("Segoe UI", 10, FontStyle.Regular),
    ForeColor = Color.FromArgb(16, 32, 39),
    BackColor = Color.White,
    BorderStyle = BorderStyle.FixedSingle,
    Location = new Point(32, 238),
    Size = new Size(640, 116)
};
checklist.Items.Add("Self-hosted server: http://127.0.0.1:8080");
checklist.Items.Add("Web vault: http://127.0.0.1:5173");
checklist.Items.Add("Encrypted sync records: server stores ciphertext only");
checklist.Items.Add("Desktop native vault UX: scaffolded for Windows release track");

var openWeb = new Button
{
    Text = "Open Web Vault",
    Width = 160,
    Height = 40,
    Location = new Point(32, 382),
    BackColor = Color.FromArgb(15, 118, 110),
    ForeColor = Color.White,
    FlatStyle = FlatStyle.Flat
};
openWeb.Click += (_, _) => Process.Start(new ProcessStartInfo("http://127.0.0.1:5173") { UseShellExecute = true });

var openRepo = new Button
{
    Text = "Open Repository",
    Width = 160,
    Height = 40,
    Location = new Point(204, 382),
    BackColor = Color.FromArgb(37, 99, 235),
    ForeColor = Color.White,
    FlatStyle = FlatStyle.Flat
};
openRepo.Click += (_, _) => Process.Start(new ProcessStartInfo("https://github.com/guberm/gvault") { UseShellExecute = true });

var themeButton = new Button
{
    Width = 160,
    Height = 40,
    Location = new Point(32, 108),
    FlatStyle = FlatStyle.Flat
};

var settingsButton = new Button
{
    Text = "Settings",
    Width = 160,
    Height = 40,
    Location = new Point(376, 382),
    FlatStyle = FlatStyle.Flat
};

var contentSurface = new Panel { Dock = DockStyle.Fill };
var settingsSurface = new Panel { Dock = DockStyle.Fill, Visible = false };
var settingsTitle = new Label
{
    Text = "Settings",
    Font = new Font("Segoe UI", 24, FontStyle.Bold),
    AutoSize = true,
    Location = new Point(32, 32)
};
var settingsDescription = new Label
{
    Text = "Appearance and desktop client preferences.",
    AutoSize = true,
    Location = new Point(34, 82)
};
var backToContent = new Button
{
    Text = "Back to vault",
    Width = 160,
    Height = 40,
    Location = new Point(32, 160),
    FlatStyle = FlatStyle.Flat
};

void ShowSettings()
{
    contentSurface.Visible = false;
    settingsSurface.Visible = true;
}

void ShowContent()
{
    settingsSurface.Visible = false;
    contentSurface.Visible = true;
}

settingsButton.Click += (_, _) => ShowSettings();
backToContent.Click += (_, _) => ShowContent();
themeButton.Click += (_, _) =>
{
    darkMode = !darkMode;
    ApplyTheme(darkMode);
};

contentSurface.Controls.Add(title);
contentSurface.Controls.Add(subtitle);
contentSurface.Controls.Add(statusPanel);
contentSurface.Controls.Add(checklist);
contentSurface.Controls.Add(openWeb);
contentSurface.Controls.Add(openRepo);
contentSurface.Controls.Add(settingsButton);
settingsSurface.Controls.Add(settingsTitle);
settingsSurface.Controls.Add(settingsDescription);
settingsSurface.Controls.Add(themeButton);
settingsSurface.Controls.Add(backToContent);
form.Controls.Add(settingsSurface);
form.Controls.Add(contentSurface);
form.KeyPreview = true;
form.KeyDown += (_, eventArgs) =>
{
    if (eventArgs.KeyCode == Keys.Escape && settingsSurface.Visible) ShowContent();
};
ApplyTheme(darkMode);
Application.Run(form);

void ApplyTheme(bool dark)
{
    Directory.CreateDirectory(Path.GetDirectoryName(themePath)!);
    File.WriteAllText(themePath, dark ? "dark" : "light");
    var bg = dark ? Color.FromArgb(7, 19, 22) : Color.FromArgb(244, 247, 249);
    var surface = dark ? Color.FromArgb(16, 32, 39) : Color.White;
    var ink = dark ? Color.FromArgb(238, 247, 247) : Color.FromArgb(16, 32, 39);
    var muted = dark ? Color.FromArgb(173, 196, 200) : Color.FromArgb(99, 114, 122);

    form.BackColor = bg;
    title.ForeColor = ink;
    subtitle.ForeColor = muted;
    statusPanel.BackColor = surface;
    statusTitle.ForeColor = ink;
    statusText.ForeColor = muted;
    checklist.BackColor = surface;
    checklist.ForeColor = ink;
    contentSurface.BackColor = bg;
    settingsSurface.BackColor = bg;
    settingsTitle.ForeColor = ink;
    settingsDescription.ForeColor = muted;
    settingsButton.BackColor = surface;
    settingsButton.ForeColor = ink;
    backToContent.BackColor = surface;
    backToContent.ForeColor = ink;
    themeButton.Text = dark ? "Light mode" : "Dark mode";
    themeButton.BackColor = surface;
    themeButton.ForeColor = ink;
}

static async Task RunLoginSmokeAsync(List<string> args)
{
    var server = ReadOption(args, "--server") ?? Environment.GetEnvironmentVariable("GVAULT_SERVER_URL");
    var email = ReadOption(args, "--email") ?? Environment.GetEnvironmentVariable("GVAULT_EMAIL");
    var password = ReadOption(args, "--password") ?? Environment.GetEnvironmentVariable("GVAULT_PASSWORD");
    var evidencePath = ReadOption(args, "--evidence");

    if (string.IsNullOrWhiteSpace(server)) throw new InvalidOperationException("Missing --server or GVAULT_SERVER_URL.");
    if (string.IsNullOrWhiteSpace(email)) throw new InvalidOperationException("Missing --email or GVAULT_EMAIL.");
    if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Missing --password or GVAULT_PASSWORD.");

    var endpoint = new Uri(NormalizeServerUrl(server), "api/auth/login");
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    var payload = JsonSerializer.Serialize(new { email, password, deviceName = "Windows desktop" });
    using var response = await client.PostAsync(endpoint, new StringContent(payload, Encoding.UTF8, "application/json"));
    var body = await response.Content.ReadAsStringAsync();

    if (!response.IsSuccessStatusCode)
    {
        throw new InvalidOperationException($"Login failed with HTTP {(int)response.StatusCode}: {body}");
    }

    using var document = JsonDocument.Parse(body);
    var root = document.RootElement;
    var hasToken = root.TryGetProperty("token", out var token) && !string.IsNullOrWhiteSpace(token.GetString());
    var hasUserId = root.TryGetProperty("userId", out var userId) && !string.IsNullOrWhiteSpace(userId.GetString());
    if (!hasToken || !hasUserId)
    {
        throw new InvalidOperationException("Login response did not include token and userId.");
    }

    var message = $"GVault Windows login smoke ok for {email} at {endpoint.GetLeftPart(UriPartial.Authority)}";
    Console.WriteLine(message);
    if (!string.IsNullOrWhiteSpace(evidencePath))
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(evidencePath))!);
        await File.WriteAllTextAsync(evidencePath, message + Environment.NewLine, Encoding.UTF8);
    }
}

static Uri NormalizeServerUrl(string server)
{
    var value = server.Trim();
    if (!value.EndsWith('/')) value += "/";
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
    {
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
