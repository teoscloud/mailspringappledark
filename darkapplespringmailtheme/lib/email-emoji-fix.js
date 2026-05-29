// Counter the email-body invert filter on Unicode emoji (text nodes are inverted
// along with everything else; images already get a second invert in CSS).
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}\uFE0F?)(?:\u200D(?:\p{Extended_Pictographic}\uFE0F?))*/gu;

let _timer = null;

function walkTextNodes(root, callback) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.classList.contains('darkapple-emoji-neutral')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const pending = [];
  while (walker.nextNode()) {
    pending.push(walker.currentNode);
  }
  for (const node of pending) {
    callback(node);
  }
}

function wrapEmojisInTextNode(textNode) {
  const text = textNode.textContent;
  if (!text) {
    return;
  }
  EMOJI_RE.lastIndex = 0;
  if (!EMOJI_RE.test(text)) {
    return;
  }
  EMOJI_RE.lastIndex = 0;

  const frag = textNode.ownerDocument.createDocumentFragment();
  let lastIndex = 0;
  let match;
  while ((match = EMOJI_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      frag.appendChild(textNode.ownerDocument.createTextNode(text.slice(lastIndex, match.index)));
    }
    const span = textNode.ownerDocument.createElement('span');
    span.className = 'darkapple-emoji-neutral';
    span.textContent = match[0];
    frag.appendChild(span);
    lastIndex = EMOJI_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    frag.appendChild(textNode.ownerDocument.createTextNode(text.slice(lastIndex)));
  }
  if (textNode.parentNode) {
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

function fixDocument(doc) {
  if (!doc || !doc.body) {
    return;
  }
  const sig = `${doc.body.innerHTML.length}:${doc.body.innerText.length}`;
  if (doc.documentElement.dataset.darkappleEmojiSig === sig) {
    return;
  }
  walkTextNodes(doc.body, wrapEmojisInTextNode);
  doc.documentElement.dataset.darkappleEmojiSig = sig;
}

function fixIframe(iframe) {
  try {
    if (iframe.contentDocument && iframe.contentDocument.body) {
      fixDocument(iframe.contentDocument);
    }
  } catch (err) {
    // Cross-origin or not yet loaded — skip.
  }
}

function scanEmailIframes() {
  const list = document.querySelector('#message-list');
  if (!list) {
    return;
  }
  for (const iframe of list.querySelectorAll('iframe')) {
    fixIframe(iframe);
  }
}

function startEmojiFix() {
  if (_timer) {
    return;
  }
  _timer = setInterval(scanEmailIframes, 400);
  scanEmailIframes();
}

function stopEmojiFix() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = {
  startEmojiFix,
  stopEmojiFix,
};
