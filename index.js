#!/usr/bin/env node

var Configstore = require('configstore');
var manifest  = require('./package.json');
var config  = new Configstore(manifest.name, { username: '', password: '' });
var argv = require('yargs').argv;
var _ = require('underscore');
var epinfer = require('epinfer'),
    result,
    data;
	
var request = require('request').defaults({
	jar: require('request').jar()
});
var fs = require('fs');
var inquirer = require("inquirer");
var chalk = require('chalk');
var path = require('path');  
var rimraf = require('rimraf');

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
	var filepath = process.cwd() + path.sep +  "srt";
	var destpath = path.dirname(argv.file);
	if (result == null||!fs.existsSync(filepath)||!fs.existsSync(destpath)) return;


	fs.readdir(filepath, function(err, items) {
		for (var i=0; i<items.length; i++) {
			var srtFileTo = argv.file.replace(/\.\w+$/, (i>0? '.' + i.toString() : '') + '.srt');
			substep("Renaming: " + items[i] + " => " + srtFileTo);
			fs.createReadStream(filepath + path.sep + items[i]).pipe(fs.createWriteStream(srtFileTo));
		}
		rimraf(filepath, function () { substep("Renaming complete, cleaning temp folder.."); });
	});
	if (_.isFunction(callback)) callback();
}


function download(result, callback) {
	if (result == null) return;
	step("Requesting download for : "+chalk.cyan(result.value));
	substep("Download...");
	request.get({
		url : 'https://api.italiansubs.net/api/rest/users/login?username='+config.get('username')+'&password='+config.get('password')+'&apikey=4ffc34b31af2bca207b7256483e24aac&format=json'
	}, function (err, response, body) {
		var json = JSON.parse(body).Itasa_Rest2_Server_Users.login;
		
		if (json.status !== "success") {
			cerr("Not logged in or parsing error.");
			return;
		}
		var authcode = json.user.authcode;
		request.get({
		url : 'https://api.italiansubs.net/api/rest/subtitles/download?authcode='+authcode+'&subtitle_id='+ result.id +'&apikey=4ffc34b31af2bca207b7256483e24aac'
		})
		.pipe(fs.createWriteStream(result.value + '.zip'))
		.on('close', function() {
			substep("Unzipping...");
			fs.createReadStream(result.value + '.zip')
			.pipe(require('unzip').Extract({ path: 'srt' }))
			.on('finish', function() {
				fs.unlinkSync(result.value + '.zip');
				if (argv.file) associate(result, callback);
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
		url: 'https://www.italiansubs.net/',
		form: {
			"username":   config.get('username'),
			"passwd":     config.get('password'),
			"remember":   'yes',
			"Submit":     'Login',
			"option":     'com_user',
			"task":       'login',
			"silent":     true
		}
	}, function(err, response, body) {
		/*var cookie = response.headers['set-cookie'][0].split(';')[0];
		console.log(cookie);*/
		if (!response.headers['set-cookie']){
			cerr("Not logged in or parsing error.");
			return;
		}
		var title = query;
		if (argv.file)
			title = query.series + " " + query.season + "x" + (query.episode >= 10 ? query.episode : "0" + query.episode)
		step("Searching for : "+chalk.green(title));
		request.get({
			url: 'http://www.italiansubs.net/modules/mod_itasalivesearch/search.php?term=' + encodeURIComponent(title)
		}, function (err, response, body) {
			body = JSON.parse(body);
			if (body == null || body.length === 0) { cerr('Nothing found\n'); return;	}

			var choices = _.pluck(body, 'value').concat([(new inquirer.Separator())]);

			if (argv.lucky && argv.file) {
				var res =_.find(body, function(v) { return ((v.value.indexOf(query.screen_size) > -1) );});
				if (res)
					download(res, callback);
				else
					download(body[0], callback);
			}else if (argv.lucky) {
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
	if (!query && (argv.file && argv.file.length === 0)) {
		cerr('No search query specified\n');
		return;
	}
	if (argv.file){
		result = epinfer.process(argv.file).getData();
		search(result);
	}else{
		search(query);
	}

});