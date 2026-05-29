const fs = require('fs');
const { localized } = require('mailspring-exports');
const { getElectronRemote } = require('./electron-remote');

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function parseRawHeaders(raw) {
  const headers = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '') {
      break;
    }
    if (/^[ \t]/.test(line) && currentKey) {
      const prev = headers[currentKey];
      const joined = `${prev} ${line.trim()}`;
      headers[currentKey] = joined;
      continue;
    }
    const match = line.match(/^([^:\s]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    currentKey = match[1].toLowerCase();
    const value = match[2];
    if (headers[currentKey]) {
      const existing = headers[currentKey];
      headers[currentKey] = Array.isArray(existing) ? existing.concat(value) : [existing, value];
    } else {
      headers[currentKey] = value;
    }
  }

  return headers;
}

function headerValue(headers, name) {
  const value = headers[name.toLowerCase()];
  if (!value) {
    return '';
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

function formatContact(contact) {
  if (!contact) {
    return '';
  }
  if (Array.isArray(contact)) {
    return contact.map(formatContact).filter(Boolean).join(', ');
  }
  if (contact.name && contact.email) {
    return `${contact.name} <${contact.email}>`;
  }
  return contact.email || contact.name || '';
}

function formatMessageDate(message) {
  if (!message || !message.date) {
    return '';
  }
  try {
    return new Date(message.date).toString();
  } catch (err) {
    return String(message.date);
  }
}

function extractAuthStatus(headers) {
  const chunks = [];
  ['authentication-results', 'arc-authentication-results'].forEach((key) => {
    const value = headers[key];
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      chunks.push(...value);
    } else {
      chunks.push(value);
    }
  });

  const text = chunks.join('\n');
  const pick = (pattern) => {
    const match = text.match(pattern);
    return match ? match[1].toUpperCase() : '—';
  };

  return {
    spf: pick(/\bspf=([^\s;]+)/i),
    dkim: pick(/\bdkim=([^\s;]+)/i),
    dmarc: pick(/\bdmarc=([^\s;]+)/i),
  };
}

function buildOverviewRows(message, headers) {
  const auth = extractAuthStatus(headers);
  return [
    ['Message ID', headerValue(headers, 'message-id') || message.headerMessageId || '—', false],
    ['Created at', headerValue(headers, 'date') || formatMessageDate(message) || '—', false],
    ['From', headerValue(headers, 'from') || formatContact(message.from) || '—', false],
    ['To', headerValue(headers, 'to') || formatContact(message.to) || '—', false],
    ['Subject', headerValue(headers, 'subject') || message.subject || '—', false],
    ['SPF', auth.spf, true],
    ['DKIM', auth.dkim, true],
    ['DMARC', auth.dmarc, true],
  ];
}

function statusClass(value) {
  const upper = String(value).toUpperCase();
  if (upper === 'PASS') {
    return 'status-pass';
  }
  if (upper === 'FAIL' || upper === 'SOFTFAIL' || upper === 'HARDFAIL' || upper === 'NEUTRAL') {
    return upper === 'NEUTRAL' ? '' : 'status-fail';
  }
  return '';
}

function buildShowOriginalHtml(message, raw) {
  const headers = parseRawHeaders(raw);
  const rows = buildOverviewRows(message, headers);
  const tableRows = rows
    .map(([label, value, isStatus]) => {
      const cls = isStatus ? statusClass(value) : '';
      const tdClass = cls ? ` class="${cls}"` : '';
      return `<tr><th>${escapeHtml(label)}</th><td${tdClass}>${escapeHtml(value)}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(localized('Original Message'))}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1c1c1e;
      --surface: #2c2c2e;
      --surface-2: #3a3a3c;
      --text: #ffffff;
      --text-secondary: rgba(235, 235, 245, 0.72);
      --text-tertiary: rgba(235, 235, 245, 0.45);
      --separator: #48484a;
      --blue: #4dabff;
      --blue-hover: #6bb8ff;
      --green: #30d158;
      --red: #ff453a;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
    }
    .page {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 20px 22px 24px;
      gap: 16px;
    }
    .topbar {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    .copy-btn {
      background: var(--blue);
      border: none;
      border-radius: 8px;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      padding: 8px 16px;
      transition: background 0.12s ease;
    }
    .copy-btn:hover { background: var(--blue-hover); }
    .copy-btn.is-copied { background: var(--green); }
    .overview {
      background: var(--surface);
      border: 0.5px solid var(--separator);
      border-collapse: collapse;
      border-radius: 10px;
      overflow: hidden;
      width: 100%;
    }
    .overview th,
    .overview td {
      border-bottom: 0.5px solid var(--separator);
      padding: 10px 14px;
      text-align: left;
      vertical-align: top;
    }
    .overview tr:last-child th,
    .overview tr:last-child td { border-bottom: none; }
    .overview th {
      color: var(--text-tertiary);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      width: 120px;
    }
    .overview td {
      color: var(--text-secondary);
      word-break: break-word;
    }
    .status-pass { color: var(--green); font-weight: 600; }
    .status-fail { color: var(--red); font-weight: 600; }
    .raw-wrap {
      background: var(--surface);
      border: 0.5px solid var(--separator);
      border-radius: 10px;
      flex: 1;
      min-height: 280px;
      overflow: hidden;
    }
    .raw-label {
      border-bottom: 0.5px solid var(--separator);
      color: var(--text-tertiary);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 10px 14px;
      text-transform: uppercase;
    }
    pre {
      color: #e6e6e6;
      font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      margin: 0;
      max-height: calc(100vh - 360px);
      overflow: auto;
      padding: 16px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <h1 class="title">${escapeHtml(localized('Original Message'))}</h1>
      <button type="button" class="copy-btn" id="copy-all">${escapeHtml(localized('Copy All'))}</button>
    </div>
    <table class="overview">${tableRows}</table>
    <div class="raw-wrap">
      <div class="raw-label">${escapeHtml(localized('Original Source'))}</div>
      <pre id="raw-source">${escapeHtml(raw)}</pre>
    </div>
  </div>
  <script>
    (function () {
      var btn = document.getElementById('copy-all');
      var pre = document.getElementById('raw-source');
      var copiedLabel = ${JSON.stringify(localized('Copied!'))};
      var copyLabel = ${JSON.stringify(localized('Copy All'))};
      btn.addEventListener('click', function () {
        var text = pre.textContent || '';
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = copiedLabel;
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = copyLabel;
            btn.classList.remove('is-copied');
          }, 1600);
        }).catch(function () {
          btn.textContent = copyLabel;
        });
      });
    })();
  </script>
</body>
</html>`;
}

async function openShowOriginalWindow(message, raw, emlPath) {
  const remote = getElectronRemote();
  const html = buildShowOriginalHtml(message, raw);
  const htmlPath = `${emlPath}.html`;
  fs.writeFileSync(htmlPath, html, 'utf8');

  const win = new remote.BrowserWindow({
    width: 920,
    height: 760,
    title: localized('Original Message'),
    backgroundColor: '#1c1c1e',
    webPreferences: {
      javascript: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(`file://${htmlPath}`);
}

module.exports = {
  openShowOriginalWindow,
  buildShowOriginalHtml,
  parseRawHeaders,
};
