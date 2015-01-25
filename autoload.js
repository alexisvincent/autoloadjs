//namespace /sector/autoload

"use strict";

var walk = require('walk');
var fs = require('fs');
var path = require("path");
var util = require("util");

var namespace_tree = {};

var options = {
	listeners: {
		followLinks: false,

		file: function (root, fileStats, next) {

			var suffix = ".js";

			var namespace_regex = /^\/\/namespace\s(((\/(\w+))+)|(\/{1}))/i

			if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {

				var namespace = fs.readFileSync(path.join(root, fileStats.name), {encoding: 'utf-8'}).match(namespace_regex);

				if (namespace !== null) {
					var namespace_arr = namespace[1].split('/').splice(1);

					var tree = namespace_tree;
					for (var i = 0; i < namespace_arr.length; i++) {
						tree = tree[namespace_arr[i]] = tree[namespace_arr[i]] || {};
					}

					if (!('files' in tree)) {
						tree.files = [];
					}

					tree.files.push({
						name: fileStats.name.substr(0, fileStats.name.lastIndexOf(".")),
						filepath: './' + path.join(root, fileStats.name)
					});
				}
			}
		},
		errors: function (root, nodeStatsArray, next) {
		},
		end: function () {
			console.log(util.inspect(namespace_tree, {depth: null, colors: true}));
		}
	}
};

function autoload(dir) {
	walk.walkSync(dir, options);

}

module.exports = autoload;