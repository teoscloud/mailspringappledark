# Mailspring Dark Apple — setup

Reproduce the full Mailspring Dark Apple setup (theme + per-message action toolbar) on any machine where Mailspring is installed.

Works with Mailspring from **nixpkgs**, **Home Manager**, a **custom flake**, or a **.deb/.rpm** — user packages always live under `~/.config/Mailspring/packages/`, regardless of how the app itself is installed.

---

## What's in this folder

```
mailspringappledark/
├── setup.md                          ← this file
├── install.sh                        ← copy theme + plugin into Mailspring
├── darkapplespringmailtheme/         ← UI theme (LESS + email iframe conversion)
└── darkapple-mail-actions/         ← plugin (Reply / Reply All / Forward toolbar)
```

### Theme (`darkapplespringmailtheme`)

| Path | Purpose |
|------|---------|
| `styles/ui-variables.less` | Apple dark palette, list/sidebar colors |
| `styles/index.less` | Global chrome, flat toolbar buttons, blue Compose |
| `styles/sidebar.less` | Sidebar: blue selected text, no hover/selection fill |
| `styles/thread-list.less` | Thread list density, tighter star column, flat selection |
| `styles/message-list.less` | Message cards, hidden footer reply placeholder |
| `styles/composer.less` | Compose/reply window, pill Send button |
| `styles/email-frame.less` | Smart dark inversion inside email iframes |
| `styles/theme-colors.less` | Theme picker preview swatches |
| `lib/main.js` | Registers `email-frame.less` for iframe injection |
| `lib/email-emoji-fix.js` | Wraps Unicode emoji in iframes so invert filter does not recolor them |

### Plugin (`darkapple-mail-actions`)

| Path | Purpose |
|------|---------|
| `lib/main.js` | Plugin entry — starts toolbar mount on activate |
| `lib/toolbar-mount.js` | Injects icon toolbar per message header (DOM mount) |
| `lib/apple-mail-toolbar.js` | Legacy React toolbar (unused; kept for reference) |
| `styles/apple-mail-toolbar.less` | Pill buttons, archive dropdown menu styles |

**Plain JavaScript only** — no TypeScript build step. Mailspring loads plugins as JS at runtime.

---

## Requirements

- [Mailspring](https://getmailspring.com/) 1.9+ (tested on 1.21.1)
- Linux, macOS, or Windows

---

## Install

### Option A — install script (recommended)

```bash
cd /path/to/mailspringappledark
chmod +x install.sh
./install.sh
```

This rsyncs both packages into `~/.config/Mailspring/packages/`.

Override the target directory if needed:

```bash
MAILSPRING_PACKAGES="$HOME/.config/Mailspring/packages" ./install.sh
```

### Option B — manual copy

```bash
mkdir -p ~/.config/Mailspring/packages

cp -r darkapplespringmailtheme ~/.config/Mailspring/packages/
cp -r darkapple-mail-actions ~/.config/Mailspring/packages/
```

Symlinks also work if you prefer editing files in this repo directly:

```bash
ln -sfn "$(pwd)/darkapplespringmailtheme" ~/.config/Mailspring/packages/darkapplespringmailtheme
ln -sfn "$(pwd)/darkapple-mail-actions" ~/.config/Mailspring/packages/darkapple-mail-actions
```

---

## Enable in Mailspring

1. **Fully quit** Mailspring (not just close the window).
2. Reopen Mailspring.
3. **Theme:** `Mailspring → Settings → Appearance → Theme` → **Dark Apple**
4. **Plugin:** `Settings → Extensions` → enable **Dark Apple Mail Actions**

If the theme shows a LESS compile error, click **Continue** after fixing/syncing files, or run `./install.sh` again and restart.

---

## What you get

### Theme

- Apple-inspired dark surfaces (`#28282a` canvas, `#2c2c2e` rows/cards)
- System blue accents (`#0a84ff`), white primary text, gray secondary text
- Flat top toolbar (no gradients); blue **Compose** button
- Sidebar: selected folder = blue text only (no background block, no hover fill)
- Thread list: white sender/subject, gray snippet/time; no stock hover archive/delete buttons
- Message cards with dark header; smart email iframe dark conversion (saturated, no pure black blocks on HTML mail; plain text stays transparent on card)
- **Emoji preserved** — Unicode emoji and emoji images are counter-inverted so they keep normal colors
- Composer: pill-shaped blue Send button, dropdown opens upward
- Hidden bottom “Write a reply…” placeholder (plugin handles replies)

### Plugin

- Icon toolbar on **every message** in a thread (left of timestamp): Reply, Reply All, Forward, Delete, Archive ▾
- **Reply All** always enabled
- Archive chevron menu: **Show Original** (raw RFC2822 in pop-out window), **Delete**
- Toolbar mounts via DOM (no React registry) for reliability

---

## Updating after edits

From this directory:

```bash
./install.sh
```

Then either:

- **Full restart** — required after changing `lib/main.js`, `lib/email-emoji-fix.js`, `package.json`, or `email-frame.less` registration, or  
- **Reload window** — `Ctrl+Shift+R` (Linux/Windows) / `Cmd+Shift+R` (macOS) for LESS-only theme tweaks

---

## NixOS notes

Mailspring itself may come from your flake (e.g. teonix); **do not** need to rebuild the flake to update theme/plugin. User packages are outside the Nix store:

```
~/.config/Mailspring/packages/darkapplespringmailtheme/
~/.config/Mailspring/packages/darkapple-mail-actions/
```

Install with `./install.sh` as on any Linux system. App binary typically lives under `/nix/store/...-mailspring-.../`; that path is read-only and unchanged by this setup.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Plugin error: “must be compiled to JavaScript” | Ensure `lib/*.js` exist (not `.ts`/`.tsx`). Run `./install.sh`. |
| Toolbar buttons missing | Fully quit and reopen Mailspring. Open a thread with messages. Check `~/.config/Mailspring/darkapple-debug.log` if present (debug logging in `toolbar-mount.js`). |
| LESS compile error | Fix the named `.less` file; avoid CSS `[attr="x" i]` (unsupported by Mailspring’s LESS compiler). |
| Theme changes not visible | Select **Dark Apple** in settings; hard reload or full restart. |
| Email plain text has colored box | Ensure latest `email-frame.less` (transparent body) and `message-list.less` (`message-body` transparent) are installed. |
| Email HTML still pure black | Restart Mailspring so `email-frame.less` reloads via theme `lib/main.js`. |
| Emojis look inverted/wrong | Restart Mailspring (needs `lib/email-emoji-fix.js`). Requires full app restart, not just reload. |

### Debug log (plugin)

If toolbar issues persist, the plugin may write:

```
~/.config/Mailspring/darkapple-debug.log
```

Remove that file before a test run for a clean log.

---

## Development layout

Edit files under this repo, then:

```bash
./install.sh
# restart Mailspring or Ctrl/Cmd+Shift+R for CSS-only changes
```

### Key customization points

- **Colors:** `darkapplespringmailtheme/styles/ui-variables.less`
- **Email dark conversion:** `darkapplespringmailtheme/styles/email-frame.less`
- **Emoji handling:** `darkapplespringmailtheme/lib/email-emoji-fix.js`
- **Toolbar icons/behavior:** `darkapple-mail-actions/lib/toolbar-mount.js`
- **Toolbar look:** `darkapple-mail-actions/styles/apple-mail-toolbar.less`

---

## Uninstall

```bash
rm -rf ~/.config/Mailspring/packages/darkapplespringmailtheme
rm -rf ~/.config/Mailspring/packages/darkapple-mail-actions
```

Restart Mailspring and pick another theme in Settings.

---

## License

Both packages are MIT — see `darkapplespringmailtheme/LICENSE.md` and plugin `package.json`.
