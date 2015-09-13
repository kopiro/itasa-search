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
	process.stderr.write('Set your personal data in "~/.itasa.json"\n');
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
	}, callback);
}

function search(query, callback) {
	request('http://www.italiansubs.net/modules/mod_itasalivesearch/search.php?term=' + encodeURIComponent(query), function (err, response, body) {
		body = JSON.parse(body);
		if (body == null || body[0] == null) {
			process.stderr.write('Nothing found\n');
			return;
		}

		process.stdout.write('Downloading ' + body[0].value + '\n');
		callback(body[0].id, body[0].value);
	});
}

var tries = 0;
function download(id, value, callback) {
	request('http://www.italiansubs.net/index.php?option=com_remository&Itemid=6&func=fileinfo&id=' + id, function (err, response, body) {
		var download_link = body.match(/chk\=([^\&]+)/);
		if (!download_link) {
			if (tries++ >= 1) {
				process.stderr.write('Check validation error, maybe you\'re not logged in\n');
			} else {
				process.stdout.write('Invalid login, logging in...\n');
				login(function() {
					download(id, value, callback);
				});
			}

			return;
		}

		download_link = download_link[1];

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
}

///////////
// Start //
///////////

var query = process.argv.slice(2).join(' ');
if (!query) {
	process.stderr.write('No search query specified\n');
	return;
}

search(query, download);