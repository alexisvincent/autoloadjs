"use strict";

var walk = require('walk');
var fs = require('fs');
var path = require("path");
var util = require("util");
var through = require('through2');
var mkdirp = require('mkdirp');

var namespace_tree = {};
var happyContextualTree = {};
var suffix = ".js";
var namespace_regex = /^\/\/namespace\s[\\]?(\w[\\]?)*/i;
var autoload_regex = /autoload\(['"][\\]?([\w.][\\]?)*['"]\)/ig;

var status = {
	fileWalker: true,
	openStreams: 0
};

function logMap() {
	console.log(util.inspect(namespace_tree, {depth: null, colors: true}));
	console.log(util.inspect(happyContextualTree, {depth: null, colors: true}));
}

//Sets the namespace contect for the given path
//This is a complete waste of a function. However... 
//I've had a little alcohol.
function doTheThing(root, fileStats, namespace) {
	happyContextualTree[path.normalize(path.join(root, fileStats.name))] = namespace;
}

function buildMap(source, destination) {
	console.log("Building map");
	var fileWalker = walk.walk(source, {followLinks: false});

	fileWalker.on('file', function (root, fileStats, next) {
		if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {
			status.openStreams++;
			mkdirp.sync(path.join(destination, root));

			var stream = fs.createReadStream(path.join(root, fileStats.name), {encoding: 'utf-8'});

			stream.on('data', function (data) {

				stream.pause();

				var namespace = data.match(namespace_regex);

				//there is a namespace on the first line
				if (namespace !== null) {

					//remove everything up until the end of the word namespace, and then trim it
					namespace = ("" + namespace[0].substring(namespace[0].indexOf("namespace") + 9)).trim();

					//remove backslash if it exists
					if (namespace.charAt(0) === "\\") {
						namespace = namespace.substring(1);
					}

					//split up the namespace into its parts
					var namespace_arr = namespace.split('\\');

					doTheThing(root, fileStats, namespace_arr);

					var tree = namespace_tree;

					//for each part of the namespace, traverse the tree
					for (var i = 0; i < namespace_arr.length; i++) {

						//and get the branch of the tree we want to work with, and
						//if it doesnt exist, make it an empty object
						tree = tree[namespace_arr[i]] = tree[namespace_arr[i]] || {};
					}

					//make sure there is always a files array
					if (!('files' in tree)) {
						tree.files = [];
					}

					//push the file we found
					tree.files.push({
						name: fileStats.name.substr(0, fileStats.name.lastIndexOf(".")),
						path: './' + path.join(root, fileStats.name)
					});
				} else {
					doTheThing(root, fileStats, []);
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

		//get the current namespace context as array
		var happyContext = happyContextualTree[path.normalize(path.join(root, fileStats.name))];

		this.push(data.replace(autoload_regex, function (data) {

			var tree = JSON.parse(JSON.stringify(namespace_tree));
			var filePath = '';

			try {
				var namespace_arr = data.substring(10, data.length - 2).split('\\');

				var relative = true;
				var file = namespace_arr.pop();

				if (namespace_arr[0] === '') {
					namespace_arr.shift();
					relative = false;
				}

				if (relative) {
					for (var i = 0; i < happyContext.length; i++) {
						tree = tree[happyContext[i]];
					}
				}

				for (var i = 0; i < namespace_arr.length; i++) {
					tree = tree[namespace_arr[i]];
				}

				for (var i = 0; i < tree.files.length; i++) {
					if (tree.files[i].name === file) {
						filePath = "./" + path.relative(path.join(root), tree.files[i].path);
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