const { startToolbarMount, stopToolbarMount } = require('./toolbar-mount');

module.exports = {
  activate() {
    startToolbarMount();
  },

  deactivate() {
    stopToolbarMount();
  },
};
