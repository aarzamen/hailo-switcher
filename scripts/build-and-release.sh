#!/usr/bin/env bash
set -euo pipefail

# Build and package Hailo Switcher for Raspberry Pi 5 (aarch64)
#
# Prerequisites:
#   - Rust toolchain (rustup)
#   - Bun (or npm)
#   - libwebkit2gtk-4.1-dev, libgtk-3-dev, libayatana-appindicator3-dev
#
# Usage:
#   ./scripts/build-and-release.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Hailo Switcher Build ==="
echo "Project: $PROJECT_DIR"
echo ""

# 1. Install frontend dependencies
echo "[1/4] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# 2. TypeScript check
echo "[2/4] TypeScript check..."
npx tsc --noEmit

# 3. Build
echo "[3/4] Building release..."
bun run tauri build

# 4. Locate artifacts
echo "[4/4] Build complete!"
echo ""

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
BINARY="src-tauri/target/release/hailo-switcher"
DEB="src-tauri/target/release/bundle/deb/Hailo Switcher_${VERSION}_arm64.deb"

echo "Artifacts:"
if [ -f "$BINARY" ]; then
  echo "  Binary: $BINARY ($(du -h "$BINARY" | cut -f1))"
fi
if [ -f "$DEB" ]; then
  echo "  Debian: $DEB ($(du -h "$DEB" | cut -f1))"
fi

echo ""
echo "Run with:"
echo "  WEBKIT_DISABLE_DMABUF_RENDERER=1 $BINARY"
echo ""
echo "Install .deb with:"
echo "  sudo dpkg -i \"$DEB\""
