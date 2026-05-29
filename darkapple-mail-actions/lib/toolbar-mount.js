const {
  localized,
  Actions,
  MessageStore,
  TaskFactory,
  TaskQueue,
  GetMessageRFC2822Task,
  FocusedPerspectiveStore,
} = require('mailspring-exports');
const { getElectronRemote } = require('./electron-remote');
const { openShowOriginalWindow } = require('./show-original-view');

// --- lightweight debug logging (only errors / mount problems) ---
const _fs = require('fs');
const _os = require('os');
const _path = require('path');
const DEBUG_LOG = _path.join(_os.homedir(), '.config', 'Mailspring', 'darkapple-debug.log');
function dbg(msg) {
  try {
    _fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (err) {
    // ignore
  }
}

let _messageUnlisten = null;
let _pollTimer = null;
const _hosts = new Map(); // header `.message-header-right` element -> host div
let _dumped = false;

// --- SF-symbol-ish line icons -------------------------------------------
const SVG_ATTRS =
  'viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  reply: `<svg ${SVG_ATTRS}><path d="M8 4 3 9l5 5"/><path d="M3 9h6.5a5 5 0 0 1 5 5"/></svg>`,
  replyAll: `<svg ${SVG_ATTRS}><path d="M6 4 1.5 9 6 14"/><path d="M11 4 6.5 9 11 14"/><path d="M6.5 9h4a5 5 0 0 1 5 5"/></svg>`,
  forward: `<svg ${SVG_ATTRS}><path d="M10 4l5 5-5 5"/><path d="M15 9H8.5a5 5 0 0 0-5 5"/></svg>`,
  trash: `<svg ${SVG_ATTRS}><path d="M3 5h12"/><path d="M7 5V3.6A1.6 1.6 0 0 1 8.6 2h.8A1.6 1.6 0 0 1 11 3.6V5"/><path d="M4.6 5l.7 9.1A1.6 1.6 0 0 0 6.9 15.6h4.2a1.6 1.6 0 0 0 1.6-1.5L13.4 5"/><path d="M7.5 8v4.2M10.5 8v4.2"/></svg>`,
  archive: `<svg ${SVG_ATTRS}><rect x="2.5" y="3" width="13" height="3.3" rx="1"/><path d="M3.6 6.3v7.2A1.6 1.6 0 0 0 5.2 15h7.6a1.6 1.6 0 0 0 1.6-1.5V6.3"/><path d="M7 9h4"/></svg>`,
  source: `<svg ${SVG_ATTRS}><path d="M5.5 4 2.5 9l3 5"/><path d="M12.5 4l3 5-3 5"/></svg>`,
};

function getMessages() {
  return (MessageStore.items() || []).filter((m) => !m.draft);
}

function getCaps(thread) {
  let canArchive = false;
  let canDelete = false;
  try {
    const perspective = FocusedPerspectiveStore.current();
    if (perspective) {
      canArchive = perspective.canArchiveThreads([thread]);
      canDelete = perspective.canMoveThreadsTo([thread], 'trash');
    }
  } catch (err) {
    dbg(`getCaps ERROR: ${err}`);
  }
  return { canArchive, canDelete };
}

function dumpStructure(list) {
  if (_dumped) {
    return;
  }
  _dumped = true;
  try {
    dbg(`DUMP: #message-list found=${!!document.querySelector('#message-list')}`);
    dbg(`DUMP: [role=list] found=${!!list}`);
    const ml = document.querySelector('#message-list');
    if (ml) {
      const kids = Array.from(ml.children).map((c) => c.className || c.tagName);
      dbg(`DUMP: #message-list children classes = ${JSON.stringify(kids)}`);
    }
    const scope = list || ml;
    if (scope) {
      const wraps = scope.querySelectorAll('.message-item-wrap');
      dbg(`DUMP: .message-item-wrap count = ${wraps.length}`);
      const headers = scope.querySelectorAll('header');
      dbg(`DUMP: header count = ${headers.length}`);
      const lastHeader = headers[headers.length - 1];
      if (lastHeader) {
        dbg(`DUMP last header HTML:\n${lastHeader.outerHTML.slice(0, 3000)}`);
      } else {
        const item = scope.querySelector('.message-item-area') || wraps[wraps.length - 1];
        if (item) {
          dbg(`DUMP last item HTML:\n${item.outerHTML.slice(0, 3000)}`);
        } else {
          dbg(`DUMP scope HTML:\n${scope.outerHTML.slice(0, 3000)}`);
        }
      }
    }
  } catch (err) {
    dbg(`DUMP error: ${err && err.stack ? err.stack : err}`);
  }
}

let _sidebarDumped = false;
function dumpSidebar() {
  if (_sidebarDumped) {
    return;
  }
  const sidebar = document.querySelector('.account-sidebar');
  if (!sidebar) {
    return;
  }
  _sidebarDumped = true;
  try {
    const selected = sidebar.querySelector('.item.selected, .item.active');
    if (selected) {
      const cs = getComputedStyle(selected);
      dbg(
        `SIDEBAR selected item: padding-left=${cs.paddingLeft} margin-left=${cs.marginLeft} className="${selected.className}"`
      );
      let node = selected.parentElement;
      let chain = [];
      while (node && !node.classList.contains('account-sidebar')) {
        const ncs = getComputedStyle(node);
        chain.push(`${node.className}|pl=${ncs.paddingLeft}|ml=${ncs.marginLeft}`);
        node = node.parentElement;
      }
      dbg(`SIDEBAR ancestor chain (item -> account-sidebar):\n${chain.join('\n')}`);
      dbg(`SIDEBAR selected outerHTML:\n${selected.outerHTML.slice(0, 600)}`);
    } else {
      dbg('SIDEBAR: no selected item found');
    }
  } catch (err) {
    dbg(`SIDEBAR dump error: ${err}`);
  }
}

// Every message header has a `.message-header-right` containing its
// `.message-time`. We mount one toolbar per real message (skipping any active
// draft composer) so older messages in the thread are actionable too.
function findHeaderRights() {
  const list = document.querySelector('#message-list');
  if (!list) {
    dumpStructure(null);
    return [];
  }
  const headers = Array.from(list.querySelectorAll('.message-header-right')).filter(
    (el) => el.querySelector('.message-time') && !el.closest('.composer-outer-wrap')
  );
  if (headers.length === 0) {
    dumpStructure(list);
  }
  return headers;
}

function ensureHostIn(header) {
  let host = _hosts.get(header);
  const time = header.querySelector('.message-time');
  if (host && host.parentNode === header) {
    // keep it positioned right before the timestamp
    if (time && host.nextElementSibling !== time) {
      header.insertBefore(host, time);
    }
    return host;
  }
  if (host && host.parentNode) {
    host.parentNode.removeChild(host);
  }
  host = document.createElement('div');
  host.className = 'apple-mail-toolbar-host';
  if (time) {
    header.insertBefore(host, time);
  } else {
    header.insertBefore(host, header.firstChild);
  }
  host.dataset.sig = '';
  _hosts.set(header, host);
  return host;
}

function cleanupHosts(activeHeaders) {
  for (const [header, host] of Array.from(_hosts.entries())) {
    if ((activeHeaders && activeHeaders.has(header)) && document.contains(header)) {
      continue;
    }
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    _hosts.delete(header);
  }
}

function stopEvent(event) {
  event.stopPropagation();
  event.preventDefault();
}

function makeIconButton(icon, title, className, onClick, disabled) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = icon;
  btn.disabled = !!disabled;
  btn.addEventListener('click', (event) => {
    stopEvent(event);
    if (!btn.disabled) {
      onClick();
    }
  });
  return btn;
}

function onReply(thread, message) {
  Actions.composeReply({ thread, message, type: 'reply', behavior: 'prefer-existing-if-pristine' });
}

function onReplyAll(thread, message) {
  Actions.composeReply({
    thread,
    message,
    type: 'reply-all',
    behavior: 'prefer-existing-if-pristine',
  });
}

function onForward(thread, message) {
  Actions.composeForward({ thread, message });
}

function onArchive(thread) {
  Actions.queueTasks(
    TaskFactory.tasksForArchiving({ threads: [thread], source: 'Dark Apple Mail Actions' })
  );
}

function onDelete(thread) {
  Actions.queueTasks(
    TaskFactory.tasksForMovingToTrash({ threads: [thread], source: 'Dark Apple Mail Actions' })
  );
}

function showOriginalError(message) {
  dbg(`onShowOriginal ERROR: ${message}`);
  try {
    if (typeof AppEnv !== 'undefined' && AppEnv.showErrorDialog) {
      AppEnv.showErrorDialog({
        title: localized('Show Original'),
        message,
      });
    }
  } catch (err) {
    // ignore
  }
}

// Fetch raw RFC2822 and open a themed viewer window.
async function onShowOriginal(message) {
  try {
    const remote = getElectronRemote();
    const filepath = _path.join(remote.app.getPath('temp'), `${message.id}.eml`);

    const task = new GetMessageRFC2822Task({
      messageId: message.id,
      accountId: message.accountId,
      filepath,
    });
    Actions.queueTask(task);
    await TaskQueue.waitForPerformRemote(task);

    const raw = _fs.readFileSync(filepath, 'utf8');
    if (!raw) {
      showOriginalError(localized('Could not load the original message source.'));
      return;
    }

    await openShowOriginalWindow(message, raw, filepath);
  } catch (err) {
    showOriginalError(err && err.message ? err.message : String(err));
  }
}

function buildToolbar(state) {
  const { thread, message, canArchive, canDelete } = state;

  const root = document.createElement('div');
  root.className = 'apple-mail-toolbar';

  const pill = document.createElement('div');
  pill.className = 'apple-mail-toolbar-pill';
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', localized('Reply actions'));

  pill.appendChild(
    makeIconButton(ICONS.reply, localized('Reply'), 'apple-mail-toolbar-segment', () =>
      onReply(thread, message)
    )
  );
  // Reply All is always available — composeReply handles single-recipient fine.
  pill.appendChild(
    makeIconButton(ICONS.replyAll, localized('Reply All'), 'apple-mail-toolbar-segment', () =>
      onReplyAll(thread, message)
    )
  );
  pill.appendChild(
    makeIconButton(ICONS.forward, localized('Forward'), 'apple-mail-toolbar-segment', () =>
      onForward(thread, message)
    )
  );
  root.appendChild(pill);

  if (canArchive || canDelete) {
    const actionPill = document.createElement('div');
    actionPill.className = 'apple-mail-toolbar-pill';
    actionPill.setAttribute('role', 'group');
    actionPill.setAttribute('aria-label', localized('Message actions'));

    if (canArchive) {
      actionPill.appendChild(
        makeIconButton(
          ICONS.archive,
          localized('Archive'),
          'apple-mail-toolbar-segment apple-mail-toolbar-archive',
          () => onArchive(thread)
        )
      );
    }
    if (canDelete) {
      actionPill.appendChild(
        makeIconButton(
          ICONS.trash,
          localized('Delete'),
          'apple-mail-toolbar-segment apple-mail-toolbar-delete',
          () => onDelete(thread)
        )
      );
    }

    root.appendChild(actionPill);
  }

  root.appendChild(
    makeIconButton(
      ICONS.source,
      localized('Show Original'),
      'apple-mail-toolbar-btn apple-mail-toolbar-show-original',
      () => onShowOriginal(message)
    )
  );

  return root;
}

function renderToolbar() {
  try {
    dumpSidebar();

    const thread = MessageStore.thread();
    const messages = getMessages();
    const headers = findHeaderRights();

    if (!thread || messages.length === 0 || headers.length === 0) {
      cleanupHosts(null);
      return;
    }

    const caps = getCaps(thread);

    // Align the trailing N headers with the trailing N messages (both are in
    // top→bottom / oldest→newest order). Tail alignment is robust to any
    // count mismatch.
    const k = Math.min(headers.length, messages.length);
    const hStart = headers.length - k;
    const mStart = messages.length - k;
    const active = new Set();

    for (let j = 0; j < k; j += 1) {
      const header = headers[hStart + j];
      const message = messages[mStart + j];
      active.add(header);

      const host = ensureHostIn(header);
      const sig = [message.id, caps.canArchive, caps.canDelete].join('|');
      if (host.dataset.sig === sig && host.childElementCount > 0) {
        continue; // unchanged — leave DOM alone so hover state isn't reset
      }
      host.innerHTML = '';
      host.appendChild(
        buildToolbar({ thread, message, canArchive: caps.canArchive, canDelete: caps.canDelete })
      );
      host.dataset.sig = sig;
    }

    cleanupHosts(active);
  } catch (err) {
    dbg(`render ERROR: ${err && err.stack ? err.stack : err}`);
  }
}

function startToolbarMount() {
  if (_messageUnlisten) {
    return;
  }
  try {
    _messageUnlisten = MessageStore.listen(renderToolbar);
  } catch (err) {
    dbg(`MessageStore.listen ERROR: ${err}`);
  }
  _pollTimer = setInterval(renderToolbar, 400);
  renderToolbar();
}

function stopToolbarMount() {
  if (_messageUnlisten) {
    _messageUnlisten();
    _messageUnlisten = null;
  }
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  cleanupHosts(null);
}

module.exports = {
  startToolbarMount,
  stopToolbarMount,
};
