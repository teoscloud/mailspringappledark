// Themes only auto-load index.less; email-frame.less must be registered
// separately so Mailspring injects it into message iframes.
const path = require('path');
const { startEmojiFix, stopEmojiFix } = require('./email-emoji-fix');

let _styleDisposable = null;

module.exports = {
  activate() {
    const sourcePath = path.join(__dirname, '..', 'styles', 'email-frame.less');
    const content = AppEnv.themes.cssContentsOfStylesheet(sourcePath);
    _styleDisposable = AppEnv.styles.addStyleSheet(content, {
      sourcePath,
      priority: 1,
    });
    startEmojiFix();
  },

  deactivate() {
    stopEmojiFix();
    if (_styleDisposable) {
      _styleDisposable.dispose();
      _styleDisposable = null;
    }
  },
};
