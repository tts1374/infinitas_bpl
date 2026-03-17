# Tauri updater configuration

The updater plugin configuration lives in [tauri.conf.json](./tauri.conf.json) under `plugins.updater`.

- `endpoints` is intentionally empty by default so local development can fall back to the current app version when no update server exists yet.
- `pubkey` is a placeholder value for PR-1. Replace it before shipping a signed updater feed.
- The frontend passes the updater `target` from `VITE_UPDATER_TARGET` or `?updateTarget=...`, defaulting to `windows-x86_64`.

For build-time injection, override the Tauri config with the `TAURI_CONFIG` environment variable.

Example:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://example.invalid/api/app/update?target={{target}}&current_version={{current_version}}"
      ],
      "pubkey": "REPLACE_WITH_MINISIGN_PUBLIC_KEY",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```
