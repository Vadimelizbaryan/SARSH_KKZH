namespace SONO.Desktop;

partial class MainForm
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
        toolStripButtonReload = new ToolStripButton();
        toolStripButtonOpenDownloads = new ToolStripButton();
        toolStripSeparator = new ToolStripSeparator();
        toolStripLabelDevice = new ToolStripLabel();
        toolStripLabelDeviceValue = new ToolStripLabel();
        statusStrip = new StatusStrip();
        toolStripStatusLabelCaption = new ToolStripStatusLabel();
        toolStripStatusLabelValue = new ToolStripStatusLabel();
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
        topToolStrip.Items.AddRange(new ToolStripItem[] { toolStripButtonReload, toolStripButtonOpenDownloads, toolStripSeparator, toolStripLabelDevice, toolStripLabelDeviceValue });
        topToolStrip.Location = new Point(0, 0);
        topToolStrip.Name = "topToolStrip";
        topToolStrip.Padding = new Padding(10, 7, 10, 7);
        topToolStrip.Size = new Size(1280, 45);
        topToolStrip.TabIndex = 0;
        //
        // toolStripButtonReload
        //
        toolStripButtonReload.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonReload.Name = "toolStripButtonReload";
        toolStripButtonReload.Size = new Size(83, 28);
        toolStripButtonReload.Text = "Обновить";
        //
        // toolStripButtonOpenDownloads
        //
        toolStripButtonOpenDownloads.DisplayStyle = ToolStripItemDisplayStyle.Text;
        toolStripButtonOpenDownloads.Name = "toolStripButtonOpenDownloads";
        toolStripButtonOpenDownloads.Size = new Size(126, 28);
        toolStripButtonOpenDownloads.Text = "Открыть Downloads";
        //
        // toolStripSeparator
        //
        toolStripSeparator.Name = "toolStripSeparator";
        toolStripSeparator.Size = new Size(6, 31);
        //
        // toolStripLabelDevice
        //
        toolStripLabelDevice.Name = "toolStripLabelDevice";
        toolStripLabelDevice.Size = new Size(95, 28);
        toolStripLabelDevice.Text = "Компьютер:";
        //
        // toolStripLabelDeviceValue
        //
        toolStripLabelDeviceValue.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        toolStripLabelDeviceValue.Name = "toolStripLabelDeviceValue";
        toolStripLabelDeviceValue.Size = new Size(102, 28);
        toolStripLabelDeviceValue.Text = "SONO Desktop";
        //
        // statusStrip
        //
        statusStrip.ImageScalingSize = new Size(20, 20);
        statusStrip.Items.AddRange(new ToolStripItem[] { toolStripStatusLabelCaption, toolStripStatusLabelValue });
        statusStrip.Location = new Point(0, 694);
        statusStrip.Name = "statusStrip";
        statusStrip.Padding = new Padding(1, 0, 18, 0);
        statusStrip.Size = new Size(1280, 26);
        statusStrip.TabIndex = 1;
        //
        // toolStripStatusLabelCaption
        //
        toolStripStatusLabelCaption.Name = "toolStripStatusLabelCaption";
        toolStripStatusLabelCaption.Size = new Size(54, 20);
        toolStripStatusLabelCaption.Text = "Статус:";
        //
        // toolStripStatusLabelValue
        //
        toolStripStatusLabelValue.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        toolStripStatusLabelValue.Name = "toolStripStatusLabelValue";
        toolStripStatusLabelValue.Size = new Size(88, 20);
        toolStripStatusLabelValue.Text = "Подготовка";
        //
        // webView
        //
        webView.AllowExternalDrop = false;
        webView.CreationProperties = null;
        webView.DefaultBackgroundColor = Color.White;
        webView.Dock = DockStyle.Fill;
        webView.Location = new Point(0, 45);
        webView.Name = "webView";
        webView.Size = new Size(1280, 649);
        webView.TabIndex = 2;
        webView.ZoomFactor = 1D;
        //
        // MainForm
        //
        AutoScaleDimensions = new SizeF(8F, 20F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(1280, 720);
        Controls.Add(webView);
        Controls.Add(statusStrip);
        Controls.Add(topToolStrip);
        MinimumSize = new Size(1040, 720);
        Name = "MainForm";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "SONO Desktop";
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
    private ToolStripButton toolStripButtonReload = null!;
    private ToolStripButton toolStripButtonOpenDownloads = null!;
    private ToolStripSeparator toolStripSeparator = null!;
    private ToolStripLabel toolStripLabelDevice = null!;
    private ToolStripLabel toolStripLabelDeviceValue = null!;
    private StatusStrip statusStrip = null!;
    private ToolStripStatusLabel toolStripStatusLabelCaption = null!;
    private ToolStripStatusLabel toolStripStatusLabelValue = null!;
    private Microsoft.Web.WebView2.WinForms.WebView2 webView = null!;
}
