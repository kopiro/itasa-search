#!/usr/bin/env node

var Configstore = require('configstore');
var manifest    = require('./package.json');
var config      = new Configstore(manifest.name, { username: '', password: '' });
var argv 				= require('yargs').argv;

var request     = require('request').defaults({
	jar: require('request').jar()
});

var fs          = require('fs');
var inquirer 		= require("inquirer");
var chalk 			= require('chalk');

var cerr        =  function(message){
	console.error(chalk.red.bold("⭑ ") + chalk.white.bgRed(message));
};;

var step        =  function(message){
	console.log(chalk.white.bold("⭑ ") + message);
};

var substep     =  function(message){
	console.log(chalk.white.bold("  ☆ ") + message);
};

function checkLoginCredentials(callback) {
	if (config.get('username')){
		callback && callback();
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
			callback && callback();
		});
	}
}

function search(query, callback, response) {
	checkLoginCredentials(function(){
		step("Login as ["+chalk.yellow(config.get('username'))+"]");
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
		},function(err, response, body) {
			step("Searching for : "+chalk.green(query));
			request.get({
				url: 'http://www.italiansubs.net/modules/mod_itasalivesearch/search.php?term=' + encodeURIComponent(query)
			}, function (err, response, body) {

				body = JSON.parse(body);

				if (body == null || body[0] == null) {
					cerr('Nothing found\n');
					return;
				}

				var choices = body.reduce(function(c,e){ c.push(e); return c; },[]);
				choices.push(new inquirer.Separator());

				inquirer.prompt([
				{
					type: "list",
					name: "sub",
					message: "Choose subtitles: ",
					choices:  choices
				}
				], function( answers ) {
					var result = '';
					body.forEach(function(v,k){
						if (v.value == answers.sub) result = v;
					});

					step("Requesting download for : "+chalk.cyan(result.value));
					substep("Getting session...");

					request.get({
						url : 'http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=fileinfo&id=' + result.id
					}, function (err, response, body) {
						var download_link = body.match(/chk\=([^\&]+)/);

						if (!download_link) {
							cerr("Not logged in.");
						} else {

							download_link = download_link[1];

							substep("Download...");
							request.get({
								url : 'http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=download&id=' + result.id + '&chk=' + download_link + '&no_html=1'
							})
							.pipe(fs.createWriteStream(result.value + '.zip'))
							.on('close', function() {
								substep("Unzipping...");
								fs.createReadStream(result.value + '.zip')
								.pipe(require('unzip').Extract({ path: '.' }))
								.on('finish', function() {
									fs.unlinkSync(result.value + '.zip');
									substep("Done.");
									callback && callback();
								});
							});
						}
					});
				});
			});
		});
	});
}

///////////
// Start //
///////////

var query = argv._.join(" ");
if (!query) {
	cerr('No search query specified\n');
	return;
}

if (argv.login){
	step("Forcing login credential re-input.");
	config.del('username');
	config.del('password');
}

search(query);
