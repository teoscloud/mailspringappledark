#!/usr/bin/env bash
# Install or update Dark Apple theme + mail-actions plugin into Mailspring.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="${MAILSPRING_PACKAGES:-$HOME/.config/Mailspring/packages}"

mkdir -p "$PKG_DIR"

rsync -a --delete "$ROOT/darkapplespringmailtheme/" "$PKG_DIR/darkapplespringmailtheme/"
rsync -a --delete "$ROOT/darkapple-mail-actions/" "$PKG_DIR/darkapple-mail-actions/"

echo "Installed to $PKG_DIR"
echo "  - darkapplespringmailtheme"
echo "  - darkapple-mail-actions"
echo ""
echo "Fully quit Mailspring, reopen, then:"
echo "  Settings → Appearance → Theme → Dark Apple"
echo "  Settings → Extensions → enable Dark Apple Mail Actions"
