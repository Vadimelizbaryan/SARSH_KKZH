# MAINFLOW Desktop

Windows shell for the MAINFLOW web app.

## What it does

- Runs the existing MAINFLOW site from local bundled files.
- Supports explicit `offline` and `online` modes.
- Keeps WebView/browser data under `%LocalAppData%\MAINFLOW.Desktop`.
- Can stay in the Windows tray and continue working in the background.
- Supports autostart with Windows in hidden `--background` mode.
- Shows tray notifications for new Telegram forms, Android MAINFORM updates, and new photo blanks.

## Offline queue

Offline edits are stored locally and added to a pending sync queue.
After the internet returns, the queue is sent automatically in the background.
The page button and the desktop shell button `Sync Queue` remain available
as a manual fallback.

## Build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File windows\build-desktop-release.ps1
```

This script publishes:

- `windows/releases/MAINFLOW.Desktop` - the unpacked desktop app folder
- `windows/releases/MAINFLOW.Desktop/package-manifest.json` - the desktop package manifest for the installer
- `windows/releases/MAINFLOW.Desktop.Setup.exe` - the downloadable Windows web installer
