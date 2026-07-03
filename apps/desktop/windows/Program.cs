using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;

ApplicationConfiguration.Initialize();

var form = new Form
{
    Text = "GVault",
    Width = 560,
    Height = 360,
    StartPosition = FormStartPosition.CenterScreen,
    BackColor = Color.FromArgb(248, 250, 252)
};

var title = new Label
{
    Text = "GVault",
    Font = new Font("Segoe UI", 24, FontStyle.Bold),
    AutoSize = true,
    Location = new Point(28, 28)
};

var body = new Label
{
    Text = "Self-hosted password and identity vault desktop preview.\n\nRun the server locally, then open the web vault for current vault operations. Native desktop sync and secure OS keychain integration are the next release target.",
    Font = new Font("Segoe UI", 11),
    Width = 490,
    Height = 120,
    Location = new Point(32, 88)
};

var openWeb = new Button
{
    Text = "Open Web Vault",
    Width = 160,
    Height = 40,
    Location = new Point(32, 230),
    BackColor = Color.FromArgb(37, 99, 235),
    ForeColor = Color.White,
    FlatStyle = FlatStyle.Flat
};
openWeb.Click += (_, _) => Process.Start(new ProcessStartInfo("https://github.com/guberm/gvault") { UseShellExecute = true });

form.Controls.Add(title);
form.Controls.Add(body);
form.Controls.Add(openWeb);
Application.Run(form);
