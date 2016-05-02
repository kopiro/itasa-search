#!/usr/bin/env node

var Configstore = require('configstore');
var manifest  = require('./package.json');
var config  = new Configstore(manifest.name, { username: '', password: '' });
var argv = require('yargs').argv;
var _ = require('underscore');

var request = require('request').defaults({
	jar: require('request').jar()
});

var fs = require('fs');
var inquirer = require("inquirer");
var chalk = require('chalk');
var exec = require('child_process').execSync;

function cerr(message){
	console.error(chalk.red.bold("⭑ ") + chalk.white.bgRed(message));
}

function cerr(message){
	console.log(chalk.white.bold("⭑ ") + message);
}

function substep(message){
	console.log(chalk.white.bold("⭑ ") + message);
}

function step(message){
	console.log(chalk.white.bold("☆ ") + message);
}

function associate(result, callback) {
	if (result == null) return;

	if (argv.file) {
		var srtFileFrom = exec('find srt -name "*.srt"').toString();
		if (srtFileFrom) {
			var srtFileTo = argv.file.replace(/\.\w+$/, '.srt');
			substep("Renaming as " + srtFileFrom);
			fs.moveSync(srtFileFrom, srtFileTo);
		}
	}

	if (_.isFunction(callback)) callback();
}


function download(result, callback) {
	if (result == null) return;

	step("Requesting download for : "+chalk.cyan(result.value));
	substep("Getting session...");

	request.get({
		url : 'http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=fileinfo&id=' + result.id
	}, function (err, response, body) {
		var download_link = body.match(/chk\=([^\&]+)/);

		if (!download_link) {
			cerr("Not logged in or parsing error.");
			return;
		}

		download_link = download_link[1];

		substep("Download...");
		request.get({
			url : 'http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=download&id=' + result.id + '&chk=' + download_link + '&no_html=1'
		})
		.pipe(fs.createWriteStream(result.value + '.zip'))
		.on('close', function() {
			substep("Unzipping...");

			fs.createReadStream(result.value + '.zip')
			.pipe(require('unzip').Extract({ path: 'srt' }))
			.on('finish', function() {
				fs.unlinkSync(result.value + '.zip');

				associate(result, callback);

			});

		});
	});
}

function checkLoginCredentials(callback) {
	if (config.get('username')){
		if (_.isFunction(callback)) callback();
	} else {
		inquirer.prompt([
		{
			type: "input",
			name: "username",
			message: "italiansubs.net username"
		},
		{
			type: "password",
			name: "password",
			message: "italiansubs.net password"
		}
		], function( answers ) {
			config.set('username',answers.username);
			config.set('password',answers.password);
			if (_.isFunction(callback)) callback();
		});
	}
}

function search(query, callback, response) {
	request.post({
		url: 'http://www.italiansubs.net/index.php',
		form: {
			"username":   config.get('username'),
			"passwd":     config.get('password'),
			"remember":   'yes',
			"Submit":     'Login',
			"option":     'com_user',
			"task":       'login',
			"39fadbc90b8639fdf04c59d7b605718e": 1,
			"return": "aW5kZXgucGhw",
			"silent":     true
		}
	}, function(err, response, body) {
		step("Searching for : "+chalk.green(query));
		request.get({
			url: 'http://www.italiansubs.net/modules/mod_itasalivesearch/search.php?term=' + encodeURIComponent(query)
		}, function (err, response, body) {
			body = JSON.parse(body);
			if (body == null || body.length === 0) { cerr('Nothing found\n'); return;	}

			var choices = _.pluck(body, 'value').concat([(new inquirer.Separator())]);

			if (argv.lucky) {
				download(body[0], callback);
			} else {
				inquirer.prompt([{
					type: "list",
					name: "sub",
					message: "Choose subtitles: ",
					choices:  choices
				}], function( answers ) {
					download(_.find(body, function(v) { return v.value == answers.sub; }), callback);
				});
			}
		});
	});
}

///////////
// Start //
///////////

if (argv.login) {
	step("Forcing login credential re-input.");
	config.del('username');
	config.del('password');
}

checkLoginCredentials(function(){
	step("Login as ["+chalk.yellow(config.get('username'))+"]");

	var query = argv._.join(" ");
	if (!query) {
		cerr('No search query specified\n');
		return;
	}

	search(query);

});