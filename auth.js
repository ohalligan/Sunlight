(() => {

  var electron = nodeRequire('electron');
  var browserWindow = electron.remote.getCurrentWindow();
  
  function getEvernote() {
    return electron.remote.getGlobal('Evernote');
  }

  window.enote = {
    fetchNoteBooks: (cb) => {
      var Evernote = getEvernote();
      var store = electron.remote.getGlobal('oauthStore');
      var sandbox = electron.remote.getGlobal('sandbox');
      var client = new Evernote.Client({token: store.oauthAccessToken, sandbox});
      var noteStore = client.getNoteStore();
      noteStore.listNotebooks(cb);  
    },
    getEvernote: getEvernote
  };

  window.enote.addSelectList = (divName) => {
    // use api's like
    enote.fetchNoteBooks((err, notebooks) => {
      if(err) {
        // handle error
        localStorage.removeItem('store');
        electron.ipcRenderer.send('application:auth-flow');
      } else {
        $("#" + divName).empty();
        enote.notebooks = notebooks;
        $.each(notebooks.sort((l, r) => {
          var ln = l.name.toUpperCase();
          var rn = r.name.toUpperCase();
          if (ln < rn) {
            return -1;
          }
          if (ln > rn) {
            return 1;
          }
          return 0;
        }), function(a, b) {
          $("#" + divName).append($("<option/>").attr("value", b.name).text(b.name));
        });
      }
    });    
  }

  var store = JSON.parse(localStorage.getItem('store') || 'null');
  var globalStore = electron.remote.getGlobal('oauthStore');
  if (store && store.oauthAccessToken) {
    globalStore.oauthAccessToken = store.oauthAccessToken;
    setTimeout(() => electron.ipcRenderer.send('application:auth-flow', store), 500);
  }
  
  if (globalStore.oauthAccessToken) {
    store = electron.remote.getGlobal('oauthStore');
    localStorage.setItem('store', JSON.stringify(store));
    setTimeout(() => enote.addSelectList('nname'), 1000);
  } else {
    setTimeout(() => electron.ipcRenderer.send('application:auth-flow', store), 1000);
  }

})();
