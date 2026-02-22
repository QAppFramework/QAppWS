# QApp WS

Turn any website into a standalone desktop app on Linux.

QApp WS wraps websites and web apps (with manifest support) as native-feeling desktop applications with their own window, icon, and launcher entry.

## What it does

- **WS (Website)**: Wraps any URL as a standalone app with its own window
- **WAPP (Web App)**: Detects web app manifests and uses name, icons, theme color, display mode, and scope for a richer experience

Enter a URL, classify it, install it — the site becomes a standalone app in your desktop menu.

## Quick install

```bash
# From source
git clone https://github.com/QAppFramework/QAppWS.git && cd QAppWS && ./install.sh
```

## Requirements

- Qt 6 (Core, Quick, WebEngine)
- Node.js 20+
- CMake, g++

See `install.sh` for full dependency details.

## License

[EUPL v1.2](https://eupl.eu/1.2/en/)
