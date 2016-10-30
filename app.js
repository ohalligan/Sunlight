(() => {
  var electron = nodeRequire('electron');

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

  // set reminder as tomorrow
  function setTomorrow() {
    var today = new Date();
    var date = today.getDate() + 1;
    var month = today.getMonth() + 1;
    var year = today.getFullYear();

    month = month < 10 ? `0${month}` : `${month}`;
    date = date < 10 ? `0${date}` : `${date}`;

    $('#datepicker').val(`${month}/${date}/${year}`);
  }

  function setFocusToTextBox() {
    document.getElementById("description").focus();
  }

  function toDateString(d) {
    return `${days[d.getDay()]}, ${months[d.getMonth() + 1]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function onDoneTitle(title) {
    title = title.replace('▢', '✓')
    return `${title} DONE on ${toDateString(new Date())}`;
  }

  function getTomorrow() {
    var tomorrow = new Date(Date.now() + 86400000);
    var ts = tomorrow.getTime();
    ts -= ts % 86400000;
    return new Date(ts);
  }

  function getReminderDate() {
    var reminder = $('#datepicker').val();
    return reminder ? new Date(reminder) : getTomorrow();
  }

  function getTitle() {
    var impact = +($('#Impact').val());
    var effort = +($('#Effort').val());
    var suffix = enote.reprioritize ? ' ↺' : '';
    if (impact || effort) {
      return `🔆 Lvl: ${calculatePriority()} task    ⮑   ${suffix}`;
    } else {
      return `📓 ${toDateString(getReminderDate())}    ⮑   ${suffix}`;
    }
  }

  function calculatePriority() {
    var impact = +($('#Impact').val());
    var effort = +($('#Effort').val());

    var priority = (((impact * 2.5) - (effort * 3)) > 0) ? ((impact * 2.5) - (effort * 3)) / 25 : -1 * ((impact * 2.5) - (effort * 3)) / -50;

    return (priority * 5 + 5.5).toFixed(1);
  }

  function resetAllFields() {
    ['description', 'tags', 'Effort', 'Impact', 'context', 'datepicker'].forEach(id => {
      $(`#${id}`).val('');

      setFocusToTextBox();

    });
  }

  function updateReminder() {
    var impact = +($('#Impact').val());
    var effort = +($('#Effort').val());
    var reminder = $('#datepicker').val();
    if (!reminder && (impact || effort)) {
      setTomorrow();
    }
  }


  window.sunshine = {

    prioritize: () => {
      updateReminder();
      var description = $('#description').val();
      if (!description.trim().length) return;
      var cmd = !enote.reprioritize ? 'application:create-note' : 'application:update-note';
      var impact = +($('#Impact').val());
      var effort = +($('#Effort').val());
      var tags = $('#tags').data().tagsinput.itemsArray.join(',');

      tags = tags.replace(/(not )?done,?/, '');
      tags = tags.replace(/impact:\s\d+,?/, '');
      tags = tags.replace(/effort:\s\d+,?/, '');

      if (impact > 0 || effort > 0) {
        if (tags) tags += ',';
        tags += "not done,impact: " + impact + ",effort: " + effort;
      }
      electron.ipcRenderer.send(cmd, {
        nname: $('#nname').val(),
        title: `${getTitle()} ${description.trim()}`,
        description: description,
        context: $('#context').val(),
        priority: (calculatePriority() * 1000) | 0,
        tags,
        impact,
        effort,
        notebooks: enote.notebooks,
        reminderTime: getReminderDate().getTime()
      });
    },
    openNote: () => {
      updateReminder();
      var description = $('#description').val();
      if (!description.trim().length) return;
      var impact = +($('#Impact').val());
      var effort = +($('#Effort').val());
      var tags = $('#tags').data().tagsinput.itemsArray.join(',');

      tags = tags.replace(/(not )?done,?/, '');
      tags = tags.replace(/impact:\s\d+,?/, '');
      tags = tags.replace(/effort:\s\d+,?/, '');

      if (impact > 0 || effort > 0) {
        if (tags) tags += ',';
        tags += "not done,impact: " + impact + ",effort: " + effort;
      }

      var reprioritize = enote.reprioritize;
      enote.reprioritize = false;
      electron.ipcRenderer.send('application:open-new-note', {
        nname: $('#nname').val(),
        title: `${getTitle()} ${description.trim()}`,
        description: description,
        context: $('#context').val(),
        priority: (calculatePriority() * 1000) | 0,
        tags,
        impact,
        effort,
        notebooks: enote.notebooks,
        reminderTime: getReminderDate().getTime()
      });
      enote.reprioritize = reprioritize;
    },
    markAsComplete: () => {
      var tags = $('#tags').data().tagsinput.itemsArray.join(',').replace(/not done,?/, '');
      if (tags) tags += ',';
      tags += 'done';
      var impact = +($('#Impact').val());
      var effort = +($('#Effort').val());
      var description = $('#description').val().trim();
      electron.ipcRenderer.send('application:mark-as-complete', {
        nname: $('#nname').val(),
        title: `${getTitle()} ${description}`,
        description: description,
        context: $('#context').val(),
        priority: (calculatePriority() * 1000) | 0,
        tags,
        impact,
        effort,
        notebooks: enote.notebooks,
        reminderTime: getReminderDate().getTime()
      });
      resetAllFields();
    }
  };

  $('#description, #Impact, #Effort, #context').on('keyup', (e) => {
    if (e.keyCode === 13 || e.key === 'Enter') {
      sunshine.prioritize();
    }
  });

  $('#description').focus();

  function fillFields({ description, impact, effort, reminder, context, tags, nname }) {
  	console.log({ description, impact, effort, reminder, context, tags, nname })
    $('#description').val(description);
    $('#Impact').val(impact);
    $('#Effort').val(effort);

    var d = new Date(reminder);
    var date = d.getDate();
    var month = d.getMonth() + 1;
    var year = d.getFullYear();

    month = month < 10 ? `0${month}` : `${month}`;
    date = date < 10 ? `0${date}` : `${date}`;

    $('#datepicker').val(`${month}/${date}/${year}`);
    $('#context').val(context);
    var tagsInput = $('#tags').data().tagsinput;
    tags.split(',').forEach(tagsInput.add.bind(tagsInput));
    $('#nname').val(nname);
  }


  var reprioritizeCallback = (_, { attr, note }) => {
  	console.log({attr, note})
    enote.reprioritize = true;
    var titleIdx = note.title.lastIndexOf('↺');
    if (titleIdx === -1) titleIdx = note.title.lastIndexOf('⮑') + 3;
    if (titleIdx !== -1) attr.fullMap.description = note.title.substr(titleIdx + 2);
    else attr.fullMap.description = note.title;

    attr.fullMap.context = $(note.content).text().trim() || '';

    if (note.tagNames) {
      attr.fullMap.tags = note.tagNames.join(',');
    }
    attr.fullMap.reminder = note.attributes.reminderTime;
    attr.fullMap.nname = note.notebookName;
    fillFields(attr.fullMap);
    $('#priority').addClass('hide');
    $('#repriority').removeClass('hide');
  };

  electron.ipcRenderer.on('sunshine:updated-note', () => {
    enote.reprioritize = false;
    resetAllFields();
    $('#priority').removeClass('hide');
    $('#repriority').addClass('hide');
  });

  electron.ipcRenderer.on('sunshine:created-note', () => {
    enote.reprioritize = false;
    resetAllFields();
    $('#priority').removeClass('hide');
    $('#repriority').addClass('hide');
  });

  electron.ipcRenderer.on('sunshine:reprioritize', reprioritizeCallback);
  electron.ipcRenderer.on('sunshine:mark-as-complete', sunshine.markAsComplete);

  electron.ipcRenderer.on('sunshine:done-note', (_, { attr, note }) => {
    enote.reprioritize = false;
    electron.ipcRenderer.send('application:update-note-title', onDoneTitle(note.title));
  });

  electron.ipcRenderer.on('sunshine:url-note', reprioritizeCallback);

})();
