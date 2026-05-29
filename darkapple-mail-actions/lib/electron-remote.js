const path = require('path');

// Plugins live outside app.asar, so `require('@electron/remote')` fails even though
// Mailspring core uses it successfully. Resolve the copy bundled with Mailspring.
function getElectronRemote() {
  try {
    return require('@electron/remote');
  } catch (err) {
    // fall through
  }

  const candidates = [];

  try {
    if (typeof AppEnv !== 'undefined' && AppEnv.getLoadSettings) {
      const { resourcePath } = AppEnv.getLoadSettings();
      if (resourcePath) {
        candidates.push(path.join(resourcePath, 'node_modules', '@electron/remote'));
      }
    }
  } catch (err) {
    // ignore
  }

  if (typeof process !== 'undefined' && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar', 'node_modules', '@electron/remote'));
    candidates.push(path.join(process.resourcesPath, 'app', 'node_modules', '@electron/remote'));
  }

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      // try next path
    }
  }

  throw new Error('Could not load @electron/remote from Mailspring.');
}

module.exports = { getElectronRemote };
