# Dark Apple — Mailspring Theme

An Apple-inspired dark theme for [Mailspring](https://getmailspring.com/), based on the official [Mailspring Theme Starter](https://github.com/Foundry376/Mailspring-Theme-Starter).

## Features

- macOS dark mode palette (`#1C1C1E`, `#2C2C2E`, system blue `#0A84FF`)
- SF Pro / `-apple-system` typography stack
- Subtle 0.5px separators and rounded message cards
- Blue-tinted selection states (sidebar + thread list)
- Thin macOS-style scrollbars
- Optional companion plugin: [Dark Apple Mail Actions](../darkapple-mail-actions) — Reply / Reply All / Forward pill, Delete, Archive menu

## Install

1. Open Mailspring → **Install New Theme…**
2. Select this folder (`darkapplespringmailtheme`)
3. Enable **Developer → Run With Debug Flags** for easier iteration
4. **Change Theme…** → choose **Dark Apple**
5. *(Optional but recommended)* Install the companion plugin: **Install Plugin…** → select `darkapple-mail-actions` (sibling folder in this repo)

### Linux install location

After installing, Mailspring copies the theme to:

| Install type | Path |
|--------------|------|
| Native | `~/.config/Mailspring/packages/darkapplespringmailtheme` |
| Snap | `~/snap/mailspring/common/packages/darkapplespringmailtheme` |

Edit files in that directory while developing, or symlink this repo there.

## Reload after changes

Open Developer Tools (**Developer → Toggle Developer Tools**) and run:

```js
AppEnv.themes.setActiveTheme('ui-light');
AppEnv.themes.setActiveTheme('darkapplespringmailtheme');
```

## Structure

```
darkapplespringmailtheme/
├── styles/
│   ├── index.less          # Main entry + global overrides
│   ├── ui-variables.less   # Color & typography tokens
│   ├── theme-colors.less   # Theme picker preview swatches
│   ├── thread-list.less
│   ├── message-list.less
│   └── sidebar.less
├── package.json
└── README.md
```

## Customize

Most colors live in `styles/ui-variables.less`. Component-specific tweaks are split into the partial LESS files under `styles/`.

## License

MIT — see [LICENSE.md](LICENSE.md)
