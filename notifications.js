'use strict';

// const electronCookies = require('electron-cookies');
const async = require('async-waterfall');

function onClick(){
async.waterfall([
  function onClickOne(done) {
		document.getElementById('no-open').style.display = "none";
		document.getElementById('yes-open').style.display = "block";
		done(null, response);
	},
	function onClickTwo(response, done) {
		sunshine.v2openNote();
		window.close();
		done();
	}
]);
};
