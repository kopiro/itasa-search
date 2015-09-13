#!/usr/bin/env node

var USER_HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];;
var request = require('request').defaults({ jar: true });
var fs = require('fs');

try {
	var config = JSON.parse(fs.readFileSync(USER_HOME + '/.itasa.json'));
	if (config == null || config.username == null || config.password == null) {
		throw new Error();
	}
} catch (err) {
	fs.writeFileSync(USER_HOME + '/.itasa.json', JSON.stringify({ username: '', password: '' }));
	process.stderr.write('Set your personal data in ~/.itasa.json');
	return;
}

function login(callback) {
	request.post({
		url: 'http://www.italiansubs.net/index.php',
		form: {
			username: config.username,
			passwd: config.password,
			remember: 'yes',
			Submit: 'Login',
			option: 'com_user',
			task: 'login',
			silent: true
		}
	}, function(err, response, body) {
		callback();
	});
}

function download(query, callback) {
	request('http://www.italiansubs.net/modules/mod_itasalivesearch/search.php?term=' + encodeURIComponent(query), function (err, response, body) {
		if (err) throw err;

		body = JSON.parse(body);
		if (!body[0]) throw 'Nothing found';

		var id = body[0].id;
		var value = body[0].value;

		console.log('Downloading ' + body[0].value);

		request('http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=fileinfo&id=' + id, function (err, response, body) {
			var download_link = body.match(/chk\=([^\&]+)/)[1];

			request('http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=download&id=' + id + '&chk=' + download_link + '&no_html=1')
			.pipe(fs.createWriteStream(value + '.zip'))
			.on('close', function() {

				fs.createReadStream(value + '.zip')
				.pipe(require('unzip').Extract({ path: '.' }))
				.on('finish', function() {
					fs.unlinkSync(value + '.zip');
					callback();
				});

			});

		});

	});
}

///////////
// Start //
///////////

var query = process.argv.slice(2).join(' ');
if (!query) {
	process.stderr.write('No search query specified');
	return;
}

login(function() {
	download(query, function() {
		console.log('OK');
	});
});