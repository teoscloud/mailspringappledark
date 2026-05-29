# Dark Apple Mail Actions

Companion plugin for the [Dark Apple](../darkapplespringmailtheme) Mailspring theme. Adds Apple Mail–style message actions at the bottom of the open email:

```
[ Reply | Reply All | Forward ]  [ Delete ]  [ Archive ▾ ]
                                              ├ Delete
                                              └ Show Original
```

## Install

1. Mailspring → **Install Plugin…** (or copy into your packages folder)
2. Select this folder (`darkapple-mail-actions`)
3. Reload Mailspring

### Linux packages path

| Install type | Path |
|--------------|------|
| Native | `~/.config/Mailspring/packages/darkapple-mail-actions` |
| Snap | `~/snap/mailspring/common/packages/darkapple-mail-actions` |

Also install the **Dark Apple** theme — it hides the stock header Reply dropdown so these buttons replace it cleanly.

## Notes

- Ships as **plain JavaScript** (`lib/main.js`) — Mailspring no longer compiles TypeScript plugins at runtime.
- **Reply All** is disabled when the message has no other recipients.
- **Archive** / **Delete** respect your account's folder permissions (same as the top toolbar).
- **Show Original** opens the raw RFC822 source in a new window.

## License

MIT
