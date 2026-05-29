const React = require('react');
const {
  localized,
  Actions,
  TaskFactory,
  TaskQueue,
  GetMessageRFC2822Task,
  FocusedPerspectiveStore,
} = require('mailspring-exports');
const { getElectronRemote } = require('./electron-remote');
const { Menu } = require('mailspring-component-kit');

class AppleMailToolbar extends React.Component {
  constructor(props) {
    super(props);
    this._archiveWrapRef = null;
    this.state = { archiveMenuOpen: false };

    this._onDocumentMouseDown = this._onDocumentMouseDown.bind(this);
    this._stop = this._stop.bind(this);
    this._onReply = this._onReply.bind(this);
    this._onReplyAll = this._onReplyAll.bind(this);
    this._onForward = this._onForward.bind(this);
    this._onArchive = this._onArchive.bind(this);
    this._onDelete = this._onDelete.bind(this);
    this._onShowOriginal = this._onShowOriginal.bind(this);
    this._onArchiveMenuSelect = this._onArchiveMenuSelect.bind(this);
    this._toggleArchiveMenu = this._toggleArchiveMenu.bind(this);
  }

  componentDidMount() {
    document.addEventListener('mousedown', this._onDocumentMouseDown);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this._onDocumentMouseDown);
  }

  _onDocumentMouseDown(event) {
    if (!this.state.archiveMenuOpen) {
      return;
    }
    if (this._archiveWrapRef && !this._archiveWrapRef.contains(event.target)) {
      this.setState({ archiveMenuOpen: false });
    }
  }

  _stop(event) {
    event.stopPropagation();
  }

  _onReply() {
    const { thread, message } = this.props;
    Actions.composeReply({
      thread,
      message,
      type: 'reply',
      behavior: 'prefer-existing-if-pristine',
    });
  }

  _onReplyAll() {
    const { thread, message } = this.props;
    Actions.composeReply({
      thread,
      message,
      type: 'reply-all',
      behavior: 'prefer-existing-if-pristine',
    });
  }

  _onForward() {
    const { thread, message } = this.props;
    Actions.composeForward({ thread, message });
  }

  _onArchive() {
    const { thread } = this.props;
    const tasks = TaskFactory.tasksForArchiving({
      threads: [thread],
      source: 'Dark Apple Mail Actions',
    });
    Actions.queueTasks(tasks);
    this.setState({ archiveMenuOpen: false });
  }

  _onDelete() {
    const { thread } = this.props;
    const tasks = TaskFactory.tasksForMovingToTrash({
      threads: [thread],
      source: 'Dark Apple Mail Actions',
    });
    Actions.queueTasks(tasks);
    this.setState({ archiveMenuOpen: false });
  }

  async _onShowOriginal() {
    const { message } = this.props;
    try {
      const remote = getElectronRemote();
      const filepath = require('path').join(remote.app.getPath('temp'), message.id);
      const task = new GetMessageRFC2822Task({
        messageId: message.id,
        accountId: message.accountId,
        filepath,
      });
      Actions.queueTask(task);
      await TaskQueue.waitForPerformRemote(task);
      const win = new remote.BrowserWindow({
        width: 800,
        height: 600,
        title: `${message.subject} - RFC822`,
        webPreferences: {
          javascript: false,
          nodeIntegration: false,
        },
      });
      win.loadURL(`file://${filepath}`);
    } catch (err) {
      if (typeof AppEnv !== 'undefined' && AppEnv.showErrorDialog) {
        AppEnv.showErrorDialog({
          title: localized('Show Original'),
          message: err && err.message ? err.message : String(err),
        });
      }
    }
    this.setState({ archiveMenuOpen: false });
  }

  _onArchiveMenuSelect(item) {
    if (item.id === 'delete') {
      this._onDelete();
    } else if (item.id === 'show-original') {
      this._onShowOriginal();
    }
  }

  _toggleArchiveMenu(event) {
    event.stopPropagation();
    this.setState({ archiveMenuOpen: !this.state.archiveMenuOpen });
  }

  render() {
    const { message, thread } = this.props;
    if (!message || !thread) {
      return null;
    }

    let canReplyAll = false;
    let canArchive = false;
    let canDelete = false;

    try {
      canReplyAll = message.canReplyAll();
      const perspective = FocusedPerspectiveStore.current();
      if (perspective) {
        canArchive = perspective.canArchiveThreads([thread]);
        canDelete = perspective.canMoveThreadsTo([thread], 'trash');
      }
    } catch (err) {
      console.warn('[darkapple-mail-actions]', err);
    }

    const archiveMenuItems = [
      { id: 'delete', name: localized('Delete') },
      { id: 'show-original', name: localized('Show Original') },
    ];

    return React.createElement(
      'div',
      { className: 'apple-mail-toolbar', onClick: this._stop, onMouseDown: this._stop },
      React.createElement(
        'div',
        {
          className: 'apple-mail-toolbar-pill',
          role: 'group',
          'aria-label': localized('Reply actions'),
        },
        React.createElement(
          'button',
          { type: 'button', className: 'apple-mail-toolbar-segment', onClick: this._onReply },
          localized('Reply')
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'apple-mail-toolbar-segment',
            onClick: this._onReplyAll,
            disabled: !canReplyAll,
          },
          localized('Reply All')
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'apple-mail-toolbar-segment', onClick: this._onForward },
          localized('Forward')
        )
      ),
      canDelete &&
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'apple-mail-toolbar-btn apple-mail-toolbar-delete',
            onClick: this._onDelete,
          },
          localized('Delete')
        ),
      canArchive &&
        React.createElement(
          'div',
          {
            className: 'apple-mail-toolbar-archive-wrap',
            ref: (el) => {
              this._archiveWrapRef = el;
            },
          },
          React.createElement(
            'div',
            { className: 'apple-mail-toolbar-split' },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'apple-mail-toolbar-btn apple-mail-toolbar-archive',
                onClick: this._onArchive,
              },
              localized('Archive')
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'apple-mail-toolbar-btn apple-mail-toolbar-archive-menu',
                'aria-label': localized('Archive options'),
                'aria-haspopup': 'menu',
                'aria-expanded': this.state.archiveMenuOpen,
                onClick: this._toggleArchiveMenu,
              },
              '\u25BE'
            )
          ),
          this.state.archiveMenuOpen &&
            React.createElement(
              'div',
              { className: 'apple-mail-toolbar-archive-dropdown' },
              React.createElement(Menu, {
                items: archiveMenuItems,
                itemKey: (item) => item.id,
                itemContent: (item) => React.createElement('span', null, item.name),
                onSelect: this._onArchiveMenuSelect,
              })
            )
        )
    );
  }
}

AppleMailToolbar.displayName = 'AppleMailToolbar';

module.exports = AppleMailToolbar;
