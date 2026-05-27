# MAINFLOW Desktop

Windows shell for the MAINFLOW web app.

## What it does

- Runs the existing MAINFLOW site from local bundled files.
- Supports explicit `offline` and `online` modes.
- Keeps WebView/browser data under `%LocalAppData%\\MAINFLOW.Desktop`.

## Offline queue

Offline edits are stored locally and added to a pending sync queue.
After the internet returns, you can send the accumulated changes back to the server
from the page itself or from the desktop shell button `Синхр. накопл.`.

## Build

```powershell
dotnet publish windows\MAINFLOW.Desktop\MAINFLOW.Desktop.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o windows\releases\MAINFLOW.Desktop
```
