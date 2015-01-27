"use strict";

var walk = require('walk');
var fs = require('fs');
var path = require("path");
var util = require("util");
var through = require('through2');
var mkdirp = require('mkdirp');

var namespace_tree = {};
var suffix = ".js";
var namespace_regex = /^\/\/namespace\s\\(\w[\\]?)*/i;
var autoload_regex = /autoload\(['"]\\([\w.][\\]?)*['"]\)/ig;

var status = {
	fileWalker: true,
	openStreams: 0
};

function logMap() {
	console.log(util.inspect(namespace_tree, {depth: null, colors: true}));
}

function buildMap(source, destination) {
	var fileWalker = walk.walk(source, {followLinks: false});

	fileWalker.on('file', function (root, fileStats, next) {
		
		if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {

			status.openStreams++;
			mkdirp.sync(path.join(destination, root));

			var stream = fs.createReadStream(path.join(root, fileStats.name), {encoding: 'utf-8'});

			stream.on('data', function (data) {

				stream.pause();

				var namespace = data.match(namespace_regex);

				if (namespace !== null) {

					var namespace_arr = namespace[0].split('\\');
					namespace_arr.shift();

					if (namespace_arr[0] === '') {
						namespace_arr.shift();
					}

					var tree = namespace_tree;
					for (var i = 0; i < namespace_arr.length; i++) {
						tree = tree[namespace_arr[i]] = tree[namespace_arr[i]] || {};
					}

					if (!('files' in tree)) {
						tree.files = [];
					}

					tree.files.push({
						name: fileStats.name.substr(0, fileStats.name.lastIndexOf(".")),
						path: './' + path.join(root, fileStats.name)
					});
				}

				stream.destroy();
			});

			stream.on('error', function (error) {
				console.log(error);
				stream.destroy();
			});

			stream.on('end', function () {
				status.openStreams--;

				if (!status.fileWalker && status.openStreams === 0) {
					logMap();
					build(source, destination);
				}
			});
		}
		next();
	});

	fileWalker.on('end', function () {
		status.fileWalker = false;
	});
}

function transformer(root, fileStats) {

	var stream = through.obj(function (data, encoding, next) {

		var streamer = through();
		streamer.on('error', this.emit.bind(this, 'error'));

		this.push(data.replace(autoload_regex, function (data) {

			var tree = JSON.parse(JSON.stringify(namespace_tree));
			var filePath = '';

			try {
				var namespace_arr = data.match(/\\([\w.][\\]?)*/i)[0].split('\\').splice(1);
				var file = namespace_arr.pop();

				if (namespace_arr[0] === '') {
					namespace_arr.shift();
				}

				for (var i = 0; i < namespace_arr.length; i++) {
					tree = tree[namespace_arr[i]];
				}

				for (var i = 0; i < tree.files.length; i++) {
					if (tree.files[i].name === file) {
						filePath = "./"+path.relative(path.join(root), tree.files[i].path);
					}
				}

			} catch (err) {
				console.log("There was an error building the file path for " + data);
				console.log(err);
			}

			return "require('" + filePath + "')";
		}));

		next();
	});

	return stream;
}

function build(source, destination) {

	status.fileWalker = true;

	var fileWalker = walk.walk(source, {followLinks: false});

	fileWalker.on('file', function (root, fileStats, next) {

		if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {

			status.openStreams++;

			var stream = fs.createReadStream(path.join(root, fileStats.name), {encoding: 'utf-8'});

			stream.pipe(transformer(root, fileStats)).pipe(fs.createWriteStream(path.join(destination, root, fileStats.name)));
		}

		next();
	});

	fileWalker.on('end', function () {
		status.fileWalker = false;
	});
}

function autoload(source, destination) {
	buildMap(source, destination);
}

module.exports = autoload;