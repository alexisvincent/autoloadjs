"use strict";

var walk = require('walk');
var fs = require('fs');
var path = require("path");
var util = require("util");
var ncp = require('ncp').ncp;

ncp.limit = 16;

var namespace_tree = {};
var max_char = 255;
var suffix = ".js";
var namespace_regex = /^\/\/namespace\s\\(\w[\\]?)*/i;
var autoload_regex = /autoload\(['"]\\(\w[\\]?)*['"]\)/ig;

var options = {
	followLinks: false,
};

function log(message) {
	if (message) {
		console.log('Log: '+ message);
	} else {
		console.log('Log: ');
	}
}

function generateTree(source, destination) {
	var fileWalker = walk.walk(source, options);

	fileWalker.on('file', function (root, fileStats, next) {

		if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {

			var stream = fs.createReadStream(path.join(root, fileStats.name), {
				flags: 'r',
				encoding: 'utf-8',
				fd: null,
				bufferSize: 1
			});

			stream.addListener('data', function (char) {
				var i = 0;
				var line = '';

				while (char[i] != '\n' && i < max_char) {
					line += char[i++];
				}

				var namespace = line.match(namespace_regex);

				if (namespace !== null) {
					var namespace_arr = namespace[0].split('\\').splice(1);

					if (namespace_arr[0] == '') {
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

			stream.addListener('error', function (error) {
				stream.destroy();
			});
		}
		next();
	});

	fileWalker.on('end', function () {
		console.log(util.inspect(namespace_tree, {depth: null, colors: true}));
		build(source, destination)
	});
}

function build(source, destination) {

	var ncpOptions = {
		transform: function (input, output) {

			input.setEncoding('utf8');
			input.on('data', function (data) {
				output.write(data.replace(autoload_regex, function (data) {
					
					var tree = JSON.parse(JSON.stringify(namespace_tree));
					var path = '';
					
					try {
						var namespace_arr = data.match(/\\(\w[\\]?)*/i)[0].split('\\').splice(1);
						var file = namespace_arr.pop();

						if (namespace_arr[0] == '') {
							namespace_arr.shift();
						}

						for (var i = 0; i < namespace_arr.length; i++) {
							tree = tree[namespace_arr[i]];
						}
						
						for (var i = 0; i < tree.files.length; i++) {
							if (tree.files[i].name === file) {
								path = tree.files[i].path;
							}
						}
						
					} catch(err) {
						console.log("There was an error building the file path for " + data);
						console.log(err)
					}

					return "require('" + path + "')";
				}));
			});



		}
	};

	ncp(source, destination, ncpOptions, function (err) {
		if (err) {
			console.error(err);
		}
		console.log('done!');
	});
}

function autoload(source, destination) {
	generateTree(source, destination);
}

module.exports = autoload;