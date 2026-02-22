#!/usr/bin/env bash
# QApp Framework — Developer Preview Installer (alpha)
# Clones, builds, and installs QApp from source.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/QAppFramework/QApp/main/install.sh | bash
#   — or —
#   git clone https://github.com/QAppFramework/QApp.git && cd QApp && ./install.sh
#
# Licensed under EUPL v1.2

set -euo pipefail

REPO_URL="https://github.com/QAppFramework/QApp.git"
INSTALL_DIR="$HOME/.local/share/qapp-framework"
BIN_DIR="$HOME/.local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[QApp]${NC} $1"; }
warn()  { echo -e "${YELLOW}[QApp]${NC} $1"; }
error() { echo -e "${RED}[QApp]${NC} $1" >&2; }
die()   { error "$1"; exit 1; }

# ── Check prerequisites ──────────────────────────────────────

check_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required: $1 — $2"
}

info "Checking prerequisites..."

check_command node    "Install Node.js 20+ (https://nodejs.org)"
check_command npm     "Comes with Node.js"
check_command cmake   "Install: sudo apt install cmake"
check_command g++     "Install: sudo apt install g++"

# Check Node.js version (need 20+)
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 20 ] 2>/dev/null || die "Node.js 20+ required (found: $(node -v))"

# Check Qt6 dev packages
pkg-config --exists Qt6Core Qt6Quick Qt6WebEngineQuick 2>/dev/null || {
    error "Qt6 development packages not found."
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt install qt6-base-dev qt6-declarative-dev qt6-webengine-dev"
    echo "    sudo apt install qml6-module-qtquick-controls qml6-module-qtwebengine"
    echo "    sudo apt install qml6-module-qtquick-layouts qml6-module-qtcore"
    echo ""
    echo "  Fedora:"
    echo "    sudo dnf install qt6-qtbase-devel qt6-qtdeclarative-devel qt6-qtwebengine-devel"
    echo ""
    die "Install Qt6 packages and try again."
}

info "All prerequisites met."

# ── Clone or use local repo ───────────────────────────────────

SOURCE_DIR=""

if [ -f "CMakeLists.txt" ] && [ -f "package.json" ] && grep -q "qapp" package.json 2>/dev/null; then
    info "Running from QApp source directory."
    SOURCE_DIR="$(pwd)"
else
    info "Cloning QApp from GitHub..."
    TMPDIR=$(mktemp -d)
    trap 'rm -rf "$TMPDIR"' EXIT
    git clone --depth 1 "$REPO_URL" "$TMPDIR/qapp"
    SOURCE_DIR="$TMPDIR/qapp"
fi

cd "$SOURCE_DIR"

# ── Install npm dependencies ──────────────────────────────────

info "Installing Node.js dependencies..."
npm install --omit=dev --silent 2>/dev/null || npm install --omit=dev

# ── Build with CMake ──────────────────────────────────────────

info "Building QApp (cmake)..."
cmake -B build -DCMAKE_BUILD_TYPE=Release -Wno-dev 2>/dev/null
cmake --build build --parallel

[ -f "build/qapp-installer" ]          || die "Build failed: qapp-installer binary not found"
[ -f "build/qapp-wrapper" ] || die "Build failed: qapp-wrapper binary not found"

info "Build successful."

# ── Install to ~/.local/share/qapp-framework/ ────────────────

info "Installing to $INSTALL_DIR ..."

mkdir -p "$INSTALL_DIR/app"
mkdir -p "$INSTALL_DIR/bin"
mkdir -p "$INSTALL_DIR/src"
mkdir -p "$BIN_DIR"

# Binaries
cp build/qapp-installer "$INSTALL_DIR/app/"
cp build/qapp-wrapper   "$INSTALL_DIR/app/"

# CLI scripts
cp bin/*.js "$INSTALL_DIR/bin/"

# JS source modules
cp src/*.js "$INSTALL_DIR/src/"
cp src/*.d.ts "$INSTALL_DIR/src/" 2>/dev/null || true

# Package files + dependencies
cp package.json "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/"

# Config files needed for typecheck (not critical for runtime)
cp jsconfig.json "$INSTALL_DIR/" 2>/dev/null || true

# ── Create .desktop entry ─────────────────────────────────────

info "Creating desktop launcher..."

mkdir -p "$HOME/.local/share/applications"

cat > "$HOME/.local/share/applications/qapp-installer.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=QApp
Comment=Install websites as standalone desktop apps
Exec=$INSTALL_DIR/app/qapp-installer
Icon=applications-internet
Terminal=false
StartupNotify=true
Categories=Network;WebBrowser;Utility;
DESKTOP

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# ── Summary ───────────────────────────────────────────────────

echo ""
info "╔══════════════════════════════════════════════╗"
info "║  QApp installed successfully! (alpha)        ║"
info "╠══════════════════════════════════════════════╣"
info "║                                              ║"
info "║  Launch from KDE/GNOME menu: search 'QApp'   ║"
info "║                                              ║"
info "║  Or from terminal:                           ║"
info "║    $INSTALL_DIR/app/qapp-installer ║"
info "║                                              ║"
info "║  CLI tools:                                  ║"
info "║    node $INSTALL_DIR/bin/install.js <url>    ║"
info "║    node $INSTALL_DIR/bin/list.js             ║"
info "║    node $INSTALL_DIR/bin/uninstall.js <id>   ║"
info "║                                              ║"
info "╚══════════════════════════════════════════════╝"
echo ""
