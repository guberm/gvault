using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

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
    Location = new Point(376, 382),
    FlatStyle = FlatStyle.Flat
};
themeButton.Click += (_, _) =>
{
    darkMode = !darkMode;
    ApplyTheme(darkMode);
};

form.Controls.Add(title);
form.Controls.Add(subtitle);
form.Controls.Add(statusPanel);
form.Controls.Add(checklist);
form.Controls.Add(openWeb);
form.Controls.Add(openRepo);
form.Controls.Add(themeButton);
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
    themeButton.Text = dark ? "Light mode" : "Dark mode";
    themeButton.BackColor = surface;
    themeButton.ForeColor = ink;
}
