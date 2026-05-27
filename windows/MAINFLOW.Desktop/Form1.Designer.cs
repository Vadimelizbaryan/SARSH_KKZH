namespace MAINFLOW.Desktop;

partial class Form1
{
    private System.ComponentModel.IContainer components = null!;

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            components?.Dispose();
        }
        base.Dispose(disposing);
    }

    #region Windows Form Designer generated code

    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();
        topToolStrip = new ToolStrip();
        toolStripButtonHome = new ToolStripButton();
        toolStripButtonSetup = new ToolStripButton();
        toolStripButtonFeedback = new ToolStripButton();
        toolStripButtonReload = new ToolStripButton();
        toolStripButtonOpenDataFolder = new ToolStripButton();
        toolStripSeparatorLeft = new ToolStripSeparator();
        toolStripLabelMode = new ToolStripLabel();
        toolStripComboBoxMode = new ToolStripComboBox();
        toolStripSeparatorRight = new ToolStripSeparator();
        toolStripLabelNetwork = new ToolStripLabel();
        bannerLabel = new Label();
        statusStrip = new StatusStrip();
        toolStripStatusLabelPage = new ToolStripStatusLabel();
        toolStripStatusLabelSpring = new ToolStripStatusLabel();
        toolStripStatusLabelModeCaption = new ToolStripStatusLabel();
        toolStripStatusLabelModeValue = new ToolStripStatusLabel();
        toolStripStatusLabelNetworkCaption = new ToolStripStatusLabel();
        toolStripStatusLabelNetworkValue = new ToolStripStatusLabel();
        networkTimer = new System.Windows.Forms.Timer(components);
        webView = new Microsoft.Web.WebView2.WinForms.WebView2();
        topToolStrip.SuspendLayout();
        statusStrip.SuspendLayout();
        ((System.ComponentModel.ISupportInitialize)webView).BeginInit();
        SuspendLayout();
        // 
        // topToolStrip
        // 
        topToolStrip.GripStyle = ToolStripGripStyle.Hidden;
        topToolStrip.ImageScalingSize = new Size(20, 20);
        topToolStrip.Items.AddRange(new ToolStripItem[] { toolStripButtonHome, toolStripButtonSetup, toolStripButtonFeedback, toolStripButtonReload, toolStripButtonOpenDataFolder, toolStripSeparatorLeft, toolStripLabelMode, toolStripComboBoxMode, toolStripSeparatorRight, toolStripLabelNetwork });
        topToolStrip.Location = new Point(0, 0);
        topToolStrip.Name = "topToolStrip";
        topToolStrip.Padding = new Padding(8, 6, 8, 6);
        topToolStrip.Size = new Size(1440, 45);
        topToolStrip.TabIndex = 0;
        // 
        // toolStripButtonHome
        // 
        toolStripButtonHome.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonHome.Name = "toolStripButtonHome";
        toolStripButtonHome.Size = new Size(64, 30);
        toolStripButtonHome.Text = "Главная";
        // 
        // toolStripButtonSetup
        // 
        toolStripButtonSetup.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonSetup.Name = "toolStripButtonSetup";
        toolStripButtonSetup.Size = new Size(79, 30);
        toolStripButtonSetup.Text = "Настройки";
        // 
        // toolStripButtonFeedback
        // 
        toolStripButtonFeedback.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonFeedback.Name = "toolStripButtonFeedback";
        toolStripButtonFeedback.Size = new Size(72, 30);
        toolStripButtonFeedback.Text = "OCR журнал";
        // 
        // toolStripButtonReload
        // 
        toolStripButtonReload.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonReload.Name = "toolStripButtonReload";
        toolStripButtonReload.Size = new Size(81, 30);
        toolStripButtonReload.Text = "Обновить";
        // 
        // toolStripButtonOpenDataFolder
        // 
        toolStripButtonOpenDataFolder.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonOpenDataFolder.Name = "toolStripButtonOpenDataFolder";
        toolStripButtonOpenDataFolder.Size = new Size(98, 30);
        toolStripButtonOpenDataFolder.Text = "Папка данных";
        // 
        // toolStripSeparatorLeft
        // 
        toolStripSeparatorLeft.Name = "toolStripSeparatorLeft";
        toolStripSeparatorLeft.Size = new Size(6, 33);
        // 
        // toolStripLabelMode
        // 
        toolStripLabelMode.Name = "toolStripLabelMode";
        toolStripLabelMode.Size = new Size(49, 30);
        toolStripLabelMode.Text = "Режим:";
        // 
        // toolStripComboBoxMode
        // 
        toolStripComboBoxMode.DropDownStyle = ComboBoxStyle.DropDownList;
        toolStripComboBoxMode.Name = "toolStripComboBoxMode";
        toolStripComboBoxMode.Size = new Size(140, 33);
        // 
        // toolStripSeparatorRight
        // 
        toolStripSeparatorRight.Name = "toolStripSeparatorRight";
        toolStripSeparatorRight.Size = new Size(6, 33);
        // 
        // toolStripLabelNetwork
        // 
        toolStripLabelNetwork.Name = "toolStripLabelNetwork";
        toolStripLabelNetwork.Size = new Size(126, 30);
        toolStripLabelNetwork.Text = "Интернет: проверка...";
        // 
        // bannerLabel
        // 
        bannerLabel.BackColor = Color.FromArgb(255, 248, 232);
        bannerLabel.BorderStyle = BorderStyle.FixedSingle;
        bannerLabel.Dock = DockStyle.Top;
        bannerLabel.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        bannerLabel.ForeColor = Color.FromArgb(127, 70, 0);
        bannerLabel.Location = new Point(0, 45);
        bannerLabel.Name = "bannerLabel";
        bannerLabel.Padding = new Padding(12, 8, 12, 8);
        bannerLabel.Size = new Size(1440, 58);
        bannerLabel.TabIndex = 1;
        bannerLabel.Text = "banner";
        // 
        // statusStrip
        // 
        statusStrip.ImageScalingSize = new Size(20, 20);
        statusStrip.Items.AddRange(new ToolStripItem[] { toolStripStatusLabelPage, toolStripStatusLabelSpring, toolStripStatusLabelModeCaption, toolStripStatusLabelModeValue, toolStripStatusLabelNetworkCaption, toolStripStatusLabelNetworkValue });
        statusStrip.Location = new Point(0, 878);
        statusStrip.Name = "statusStrip";
        statusStrip.Padding = new Padding(1, 0, 18, 0);
        statusStrip.Size = new Size(1440, 26);
        statusStrip.TabIndex = 2;
        // 
        // toolStripStatusLabelPage
        // 
        toolStripStatusLabelPage.Name = "toolStripStatusLabelPage";
        toolStripStatusLabelPage.Size = new Size(73, 20);
        toolStripStatusLabelPage.Text = "Страница:";
        // 
        // toolStripStatusLabelSpring
        // 
        toolStripStatusLabelSpring.Name = "toolStripStatusLabelSpring";
        toolStripStatusLabelSpring.Size = new Size(1136, 20);
        toolStripStatusLabelSpring.Spring = true;
        // 
        // toolStripStatusLabelModeCaption
        // 
        toolStripStatusLabelModeCaption.Name = "toolStripStatusLabelModeCaption";
        toolStripStatusLabelModeCaption.Size = new Size(58, 20);
        toolStripStatusLabelModeCaption.Text = "Режим:";
        // 
        // toolStripStatusLabelModeValue
        // 
        toolStripStatusLabelModeValue.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        toolStripStatusLabelModeValue.Name = "toolStripStatusLabelModeValue";
        toolStripStatusLabelModeValue.Size = new Size(59, 20);
        toolStripStatusLabelModeValue.Text = "оффлайн";
        // 
        // toolStripStatusLabelNetworkCaption
        // 
        toolStripStatusLabelNetworkCaption.Name = "toolStripStatusLabelNetworkCaption";
        toolStripStatusLabelNetworkCaption.Size = new Size(69, 20);
        toolStripStatusLabelNetworkCaption.Text = "Интернет:";
        // 
        // toolStripStatusLabelNetworkValue
        // 
        toolStripStatusLabelNetworkValue.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        toolStripStatusLabelNetworkValue.Name = "toolStripStatusLabelNetworkValue";
        toolStripStatusLabelNetworkValue.Size = new Size(56, 20);
        toolStripStatusLabelNetworkValue.Text = "проверка";
        // 
        // networkTimer
        // 
        networkTimer.Enabled = true;
        networkTimer.Interval = 5000;
        // 
        // webView
        // 
        webView.AllowExternalDrop = false;
        webView.CreationProperties = null;
        webView.DefaultBackgroundColor = Color.White;
        webView.Dock = DockStyle.Fill;
        webView.Location = new Point(0, 103);
        webView.Name = "webView";
        webView.Size = new Size(1440, 775);
        webView.TabIndex = 3;
        webView.ZoomFactor = 1D;
        // 
        // Form1
        // 
        AutoScaleDimensions = new SizeF(8F, 20F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(1440, 904);
        Controls.Add(webView);
        Controls.Add(statusStrip);
        Controls.Add(bannerLabel);
        Controls.Add(topToolStrip);
        MinimumSize = new Size(1200, 760);
        Name = "Form1";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "MAINFLOW Desktop";
        topToolStrip.ResumeLayout(false);
        topToolStrip.PerformLayout();
        statusStrip.ResumeLayout(false);
        statusStrip.PerformLayout();
        ((System.ComponentModel.ISupportInitialize)webView).EndInit();
        ResumeLayout(false);
        PerformLayout();
    }

    #endregion

    private ToolStrip topToolStrip = null!;
    private ToolStripButton toolStripButtonHome = null!;
    private ToolStripButton toolStripButtonSetup = null!;
    private ToolStripButton toolStripButtonFeedback = null!;
    private ToolStripButton toolStripButtonReload = null!;
    private ToolStripButton toolStripButtonOpenDataFolder = null!;
    private ToolStripSeparator toolStripSeparatorLeft = null!;
    private ToolStripLabel toolStripLabelMode = null!;
    private ToolStripComboBox toolStripComboBoxMode = null!;
    private ToolStripSeparator toolStripSeparatorRight = null!;
    private ToolStripLabel toolStripLabelNetwork = null!;
    private Label bannerLabel = null!;
    private StatusStrip statusStrip = null!;
    private ToolStripStatusLabel toolStripStatusLabelPage = null!;
    private ToolStripStatusLabel toolStripStatusLabelSpring = null!;
    private ToolStripStatusLabel toolStripStatusLabelModeCaption = null!;
    private ToolStripStatusLabel toolStripStatusLabelModeValue = null!;
    private ToolStripStatusLabel toolStripStatusLabelNetworkCaption = null!;
    private ToolStripStatusLabel toolStripStatusLabelNetworkValue = null!;
    private System.Windows.Forms.Timer networkTimer = null!;
    private Microsoft.Web.WebView2.WinForms.WebView2 webView = null!;
}
