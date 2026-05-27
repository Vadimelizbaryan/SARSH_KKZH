# MAINFLOW Desktop

Windows shell for the MAINFLOW web app.

## What it does

- Runs the existing MAINFLOW site from local bundled files.
- Supports explicit `offline` and `online` modes.
- Keeps WebView/browser data under `%LocalAppData%\\MAINFLOW.Desktop`.

## Current limitation

Offline work is local-first, but a full pending-sync queue is not implemented yet.
This means the desktop app is already useful during internet outages, but the next
required step is a safe replay/merge flow for offline edits after the connection returns.

## Build

```powershell
dotnet publish windows\MAINFLOW.Desktop\MAINFLOW.Desktop.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o windows\releases\MAINFLOW.Desktop
```
