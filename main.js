var electron = require('electron');
var {Menu, app, BrowserWindow} = electron;
var path = require('path');
var express = require('express');
var router = express();
var http = require('http');
var childProcess = require('child_process');
var url = require('url');

global.Evernote = require('evernote').Evernote;
var globalShortcut = electron.globalShortcut;
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

var oauthStore = {};
var reprioritizeNote = null;
var lastNotitification = null;

global.oauthStore = oauthStore;
global.sandbox = false;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

var EDAMErrorCode = {
  1: 'UNKNOWN',
  2: 'BAD_DATA_FORMAT',
  3: 'PERMISSION_DENIED',
  4: 'INTERNAL_ERROR',
  5: 'DATA_REQUIRED',
  6: 'LIMIT_REACHED',
  7: 'QUOTA_REACHED',
  8: 'INVALID_AUTH',
  9: 'AUTH_EXPIRED',
  10: 'DATA_CONFLICT',
  11: 'ENML_VALIDATION',
  12: 'SHARD_UNAVAILABLE',
  13: 'LEN_TOO_SHORT',
  14: 'LEN_TOO_LONG',
  15: 'TOO_FEW',
  16: 'TOO_MANY',
  17: 'UNSUPPORTED_OPERATION',
  18: 'TAKEN_DOWN',
  19: 'RATE_LIMIT_REACHED',
};

var days = [
  'Sunday', 'Monday', 'Tuesday',
  'Wednesday', 'Thursday', 'Friday',
  'Saturday'
];

var months = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

function toDateString(d) {
  return `${days[d.getDay()]}, ${months[d.getMonth() + 1]} ${d.getDate()}, ${d.getFullYear()}`;
}

function onDoneTitle(title) {
  title = title.replace('▢', '✓').replace(/\sDONE\son\s.*$/, '');
  return `${title} DONE on ${toDateString(new Date())}`;
}

function createBrowserWindow(show = true) {
  var { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 300 | 0,
    height: 820,
    maxHeight: height,
    maxWidth: width,
    minWidth: 300,
    minHeight: 820,
    x: (width - (300)) | 0,
    y: 10,
    title: "Sunlight",
    // turn on causes issues like crashing at time
    // alwaysOnTop: true,
    nodeIntegration: "iframe",
    webPreferences: {
      webSecurity: false
    }
  });

  app.commandLine.appendSwitch('--disable-web-security');

  // and load the index.html of the app.
  mainWindow.loadURL('http://localhost:53546' + __dirname + '/index.html');

  if (show) mainWindow.show();
  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

function copySelection() {
  if (process.platform === 'darwin') {
    childProcess.spawnSync('osascript', [path.join(__dirname, 'selection-copy.scpt')]);
  }
}

function openAppleNote() {
  if (process.platform === 'darwin') {
    childProcess.spawnSync('osascript', [path.join(__dirname, 'openEnote.scpt')]);
  }
}

function syncEvernote() {
  mainWindow.minimize();
  if (process.platform === 'darwin') {
    childProcess.spawnSync('osascript', [path.join(__dirname, 'sync-evernote.scpt')]);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  createBrowserWindow();

  // bind registers
  var ret = globalShortcut.register('CommandOrControl+Shift+P', () => {
 var tagsinput="";
 var tagsInput="";
    if (!mainWindow) {
      createBrowserWindow();
    }
    mainWindow.show();
    mainWindow.focus();

  });

  var ret = globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (process.platform === 'darwin') {
      childProcess.spawnSync('osascript', [path.join(__dirname, 'sortList.scpt')]);
    }
  });

  if (!ret) {
    console.log('registeration failed for CommandOrControl+Shift+P');
  }

  ret = globalShortcut.register('CommandOrControl+Shift+[', () => {
    copySelection();
    if (!mainWindow) {
      createBrowserWindow();
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    reprioritize();
  });

  if (!ret) {
    console.log('registeration failed for CommandOrControl+Shift+[');
  }

  ret = globalShortcut.register('CommandOrControl+Shift+]', () => {
    copySelection();
    if (!mainWindow) {
      createBrowserWindow();
    }
    mainWindow.hide();
    mainWindow.minimize();
    doneNote();
  });

  if (!ret) {
    console.log('registeration failed for CommandOrControl+Shift+]');
  }


  // bind registers
  var ret = globalShortcut.register('CommandOrControl+Shift+/', () => {
    if (!mainWindow) {
      createBrowserWindow();
    }
    mainWindow.show();
    mainWindow.focus();
    var text = electron.clipboard.readText();
    var { protocol, host, hash } = url.parse(text);

    if (protocol === 'https:' && host === `${global.sandbox ? 'sandbox.' : '' }evernote.com` && hash && hash.indexOf('n=') != -1) {
      var start = hash.indexOf('n=') + 2;
      var guid = hash.substr(start).split('&')[0];
      findNoteWithGUID(guid, (meta) => {
        reprioritizeNote = meta.note;
        mainWindow.webContents.send('sunshine:url-note', meta);
        console.log(meta)
      });
    }
  });

  if (!ret) {
    console.log('registeration failed for CommandOrControl+Shift+/');
  }
  var template = [{
        label: "Application",
        submenu: [
            { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
            { type: "separator" },
            { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
        ]}, {
        label: "Edit",
        submenu: [
            { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
            { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
            { type: "separator" },
            { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
            { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
            { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
            { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
        ]}
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on('will-quit', () => {
  globalShortcut.unregister('CommandOrControl+Shift+P');
  globalShortcut.unregister('CommandOrControl+Shift+E');
  globalShortcut.unregister('CommandOrControl+Shift+[');
  globalShortcut.unregister('CommandOrControl+Shift+]');
  globalShortcut.unregister('CommandOrControl+Shift+/');
  globalShortcut.unregisterAll();
});

app.on('activate', (event, hasVisibleWindows) => {
  if (!hasVisibleWindows || !mainWindow) {
    createBrowserWindow();
  }
});
process.on('uncaughtException', (e) => {
  console.log('uncaught exception', e);
  // enable if it make sense
  // if (e.message && e.message.indexOf('EADDRINUSE') !== -1) {
  //   setTimeout(() => {
  //     server.listen(router.get('port'), function() {
  //       console.log('Express server listening on port ' + router.get('port'));
  //     });
  //   }, 3000);
  // }
});

router.set('port', 53546);

var content = require('fs').readFileSync(__dirname + '/index.html').toString();
var loadedFromRequest = false;
router.get(__dirname + '/index.html', function(req, res) {
  oauthStore.oauth_verifier = req.query.oauth_verifier || oauthStore.oauth_verifier;
  oauthStore.oauth_token = req.query.oauth_token || oauthStore.oauth_token;

  if (loadedFromRequest) {
    requestAccessToken(client, function(error) {
      if (error) {
        console.log('access error', error);
        return;
      }
      res.send(content);
    });
  } else res.send(content);
  loadedFromRequest = false;
});

var notificationTemplate = require('fs').readFileSync(__dirname + '/notification.html').toString();
var loadedFromRequest = false;
router.get(__dirname + '/notification.html', function(req, res) {
  if (!lastNotitification) return;
  var data = notificationTemplate;
  data = data.replace('<!-- REPLACE TITLE -->', lastNotitification.heading);
  data = data.replace('<!-- REPLACE DESC -->', lastNotitification.desc);
  res.send(data);
});

router.use(express.static('/'));

var server = http.createServer(router);
server.listen(router.get('port'), function() {
  console.log('Express server listening on port ' + router.get('port'));
});


var Evernote = require('evernote').Evernote;
var client = new Evernote.Client({
  consumerKey: 'owenhalligan',
  consumerSecret: '52bef171b562cd94',
  sandbox: global.sandbox
});

electron.ipcMain.on('application:auth-flow', function(sender, store) {
  console.log('application:auth-flow', oauthStore, client);
  if (!oauthStore.oauthAccessToken && store) { oauthStore = store; }
  if (!oauthStore.oauthAccessToken) {
    requestOAuthToken(client, function(error) {
      if (error) {
        console.log('oauth error', error);
        return;
      }
      loadedFromRequest = true;
      mainWindow.loadURL(client.getAuthorizeUrl(oauthStore.oauthToken));
    });
  }
});

electron.ipcMain.on('application:mark-as-complete', function(sender, meta) {
  doneNoteWithGUID(reprioritizeNote, meta, () => {
    mainWindow.webContents.send('sunshine:updated-note');
  });
});

function createOrUpdateNote(meta, create, cb = () => {}) {
  var note = new Evernote.Note();
  var notebookName = meta.nname;
  var notebook = (meta.notebooks || []).find(({ name }) => name === notebookName);

  if (notebook) {
    note.notebookGuid = notebook.guid;
  }

  if (!create) {
    note.guid = reprioritizeNote.guid;
  }

  note.title = meta.title;

  var description = meta.description;
  var context = meta.context;

  var body = `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
    <en-note>
      <em>
        ${context}
      </em>
    </en-note>
  `;

  note.content = body;

  var tags = meta.tags;
  if (tags) {
    note.tagNames = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length !== 0);
  }

  var attributes = new Evernote.NoteAttributes();
  attributes.reminderTime = meta.reminderTime;
  attributes.reminderOrder = meta.priority;
  attributes.sourceApplication = 'sunshine';
  note.attributes = attributes;

  var store = oauthStore;
  var client = new Evernote.Client({ token: store.oauthAccessToken, sandbox: global.sandbox });
  var noteStore = client.getNoteStore();
  var run = create ? noteStore.createNote.bind(noteStore) : noteStore.updateNote.bind(noteStore);
  run(note, (error, note) => {
    if (error) {
      console.log(`${EDAMErrorCode[error.errorCode]} error`);
      // createNotificationWindow(`Error: ${EDAMErrorCode[error.errorCode]}`);
    } else {
      console.log(note, ' created');
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "priority", `${meta.priority}`, (e) => {
        if (e) console.log(e);
      });
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "impact", `${meta.impact}`, (e) => {
        if (e) console.log(e);
      });
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "effort", `${meta.effort}`, (e) => {
        if (e) console.log(e);
      });
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "description", `${meta.description}`, (e) => {
        if (e) console.log(e);
      });
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "context", `${meta.context}`, (e) => {
        if (e) console.log(e);
      });
      noteStore.setNoteApplicationDataEntry(store.oauthAccessToken, note.guid, "tags", `${meta.tags}`, (e) => {
        if (e) console.log(e);
      });

      // if (mainWindow) {
      //   var tokens = client.token.split(':');
      //   var shardId = tokens.find(t => t.startsWith('S=')).substr(2);
      //   var userId = tokens.find(t => t.startsWith('U=')).substr(2);
      //   var noteGuid = note.guid;
      //   var evernoteURL = `evernote:///view/${userId}/${shardId}/${noteGuid}/${noteGuid}/`;
      //   global.evernoteURL = evernoteURL;
      // }
      mainWindow.webContents.send(create ? 'sunshine:created-note' : 'sunshine:updated-note');
      // mainWindow.close();
      // mainWindow = null;
      syncEvernote();
      createNotificationWindow(null, note.title.replace(meta.description, ''), meta.nname, meta.description);
    }
    cb(error, note);
  });
  mainWindow.minimize();
}

electron.ipcMain.on('application:update-note', (sender, meta) => {
  createOrUpdateNote(meta, false);
});

electron.ipcMain.on('application:create-note', (sender, meta) => {
  createOrUpdateNote(meta, true);
});

electron.ipcMain.on('application:open-new-note', (sender, meta) => {
  createNewNote(meta);
});

function requestAccessToken(client, cb) {
  client.getAccessToken(oauthStore.oauthToken, oauthStore.oauthTokenSecret, oauthStore.oauth_verifier,
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
      if (!error) {
        oauthStore.oauthAccessToken = oauthAccessToken;
        oauthStore.oauthAccessTokenSecret = oauthAccessTokenSecret;
        oauthStore.edam = results;
      }
      cb(error, oauthAccessToken, oauthAccessTokenSecret, results);
    });
}

function requestOAuthToken(client, cb) {
  client.getRequestToken('http://localhost:53546' + __dirname + '/index.html',
    function(error, oauthToken, oauthTokenSecret, results) {
      if (!error) {
        oauthStore.oauthToken = oauthToken;
        oauthStore.oauthTokenSecret = oauthTokenSecret;
      }
      cb(error);
    });
}


function doneNote() {
  findNote((info) => {
    reprioritizeNote = info.note;
    mainWindow.webContents.send('sunshine:reprioritize', info);
    mainWindow.webContents.send('sunshine:mark-as-complete', info);
  });
}

function reprioritize() {
  findNote((info) => {
    console.log('found note')
    reprioritizeNote = info.note;
    mainWindow.webContents.send('sunshine:reprioritize', info);
  });
}

function createNotificationWindow(err, title, notebook, description, done = false) {

  var { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  var options = {
    width: 420,
    height: 68,
    x: width - 420,
    y: 20,
    title: "Sunlight",
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    focusable: false,
    fullscreen: false,
    fullscreenable: false
  };

  var broswer = new BrowserWindow(options);
  title = title.length > 27 ? `${title.substr(0, 26)}…` : title;
  notebook = notebook.length > 18 ? `${notebook.substr(0, 17)}…` : notebook;
  description = description.length > 57 ? `${description.substr(0, 56)}…` : description;
  lastNotitification = { heading: `${title} ${done ? '' : 'added to "'}${notebook}${done ? '' : '"'}`, desc: description };
  // and load given note the url.
  broswer.loadURL('http://localhost:53546' + __dirname + '/notification.html');

  broswer.show();
}

function createNewNote(meta) {
  createOrUpdateNote(meta, true, (err, note, noteURL) => {
    if (!err) {
      // new note link to open in new window
      if (process.platform === 'darwin') {
        openAppleNote();
      } else {
        electron.shell.openExternal(`https://${client.sandbox ? 'sandbox.' : ''}www.evernote.com/Home.action#n=${note.guid}&ses=4&sh=2&sds=5&`);
      }
    }
  });
}

function doneNoteWithGUID(note, meta, cb) {
  meta.title = onDoneTitle(note.title);
  createOrUpdateNote(meta, false, (err, note) => {
    cb(err, note);
    if (!err) {
      syncEvernote();
      createNotificationWindow(null, 'Sunlight task completed!', '', '', true);
    }
  });
}

function findNoteWithGUID(guid, cb) {
  var store = oauthStore;
  var client = new Evernote.Client({ token: store.oauthAccessToken, sandbox: global.sandbox });
  var noteStore = client.getNoteStore();

  var filter = new Evernote.NoteFilter();
  var spec = new Evernote.NotesMetadataResultSpec();
  spec.includeAttributes = true;
  spec.includeTitle = true;

  var result;
  // max - Evernote.EDAM_USER_NOTES_MAX
  noteStore.findNotesMetadata(store.oauthAccessToken, filter, 0, 1000, spec, (err, notes) => {
    if (!err) {
      if (notes.totalNotes > 0) {
        var sunshineNotes = notes.notes.filter(note => note.attributes.sourceApplication === 'sunshine');
        if (sunshineNotes.length) {
          var sunshine = sunshineNotes.find(note => note.guid === guid);
          if (sunshine) {
            noteStore.getNoteApplicationData(store.oauthAccessToken, sunshine.guid, (err, attr) => {
              if (!err) {
                noteStore.getNoteContent(store.oauthAccessToken, sunshine.guid, (err, data) => {
                  sunshine.content = data;
                  noteStore.getNoteTagNames(store.oauthAccessToken, sunshine.guid, (err, data) => {
                    sunshine.tagNames = data || '';
                    noteStore.getNotebook(store.oauthAccessToken, note.notebookGuid, (err, data) => {
                      sunshine.notebookName = data.name;
                      cb({ attr, note: sunshine });
                    });
                  });
                });
              }
            });
          }
        }
      }
    }

  });
}


function findNote(cb) {
  var store = oauthStore;
  var client = new Evernote.Client({ token: store.oauthAccessToken, sandbox: global.sandbox });
  var noteStore = client.getNoteStore();

  var filter = new Evernote.NoteFilter();
  filter.words = electron.clipboard.readText();

  var spec = new Evernote.NotesMetadataResultSpec();
  spec.includeAttributes = true;
  spec.includeTitle = true;
  spec.includeNotebookGuid = true;

  // max - Evernote.EDAM_USER_NOTES_MAX
  noteStore.findNotesMetadata(store.oauthAccessToken, filter, 0, 1000, spec, (err, notes) => {
    if (!err) {
      if (notes.totalNotes > 0) {
        var sunshineNotes = notes.notes.filter(note => note.attributes.sourceApplication === 'sunshine');
        if (sunshineNotes.length) {
          sunshineNotes.forEach(note => {
            if (note.title === filter.words) {
              noteStore.getNoteApplicationData(store.oauthAccessToken, note.guid, (err, attr) => {
                if (!err) {
                  noteStore.getNoteContent(store.oauthAccessToken, note.guid, (err, data) => {
                    note.content = data;
                    noteStore.getNoteTagNames(store.oauthAccessToken, note.guid, (err, data) => {
                      note.tagNames = data || '';
                      noteStore.getNotebook(store.oauthAccessToken, note.notebookGuid, (err, data) => {
                        note.notebookName = data.name;
                        cb({ attr, note });
                      });
                    });
                  });
                }
              });
            }
          });
        }
      }
    }

  });
}
