#!/usr/bin/env bash
# QApp self-updater — pulls latest, builds, and installs over existing.
# Designed to be run by the QApp installer app (via QProcess).
#
# Exit codes:
#   0 = success
#   1 = prerequisite missing
#   2 = build failed
#   3 = install failed

set -euo pipefail

REPO_URL="https://github.com/QAppFramework/QApp.git"
INSTALL_DIR="$HOME/.local/share/qapp-framework"

info()  { echo "[QApp] $1"; }
error() { echo "[QApp] ERROR: $1" >&2; }

# ── Check prerequisites ──────────────────────────────────────
for cmd in node npm cmake g++ git; do
    command -v "$cmd" >/dev/null 2>&1 || { error "Required: $cmd"; exit 1; }
done

# ── Clone latest to temp dir ─────────────────────────────────
info "Downloading latest QApp..."
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

git clone --depth 1 "$REPO_URL" "$TMPDIR/qapp" 2>&1 | tail -1
cd "$TMPDIR/qapp"

# ── Build ─────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --omit=dev --silent 2>/dev/null || npm install --omit=dev

info "Building..."
cmake -B build -DCMAKE_BUILD_TYPE=Release -Wno-dev 2>/dev/null
cmake --build build --parallel 2>&1 | tail -3

[ -f "build/qapp-installer" ]          || { error "qapp-installer binary not found"; exit 2; }
[ -f "build/qapp-wrapper" ] || { error "qapp-wrapper binary not found"; exit 2; }

info "Build successful."

# ── Install over existing ─────────────────────────────────────
info "Installing update..."

mkdir -p "$INSTALL_DIR/app" "$INSTALL_DIR/bin" "$INSTALL_DIR/src"

# Binaries (rename trick for running processes)
for bin in qapp-installer qapp-wrapper; do
    if [ -f "$INSTALL_DIR/app/$bin" ]; then
        mv "$INSTALL_DIR/app/$bin" "$INSTALL_DIR/app/$bin.old" 2>/dev/null || true
    fi
    cp "build/$bin" "$INSTALL_DIR/app/"
    rm -f "$INSTALL_DIR/app/$bin.old"
done

# JS source + CLI
cp src/*.js "$INSTALL_DIR/src/"
cp src/*.d.ts "$INSTALL_DIR/src/" 2>/dev/null || true
cp bin/*.js "$INSTALL_DIR/bin/"

# Dependencies
cp package.json "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/"

info "QApp updated successfully."
info "Restart QApp and all wrapper apps to use the new version."
