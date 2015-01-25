//namespace /sector/autoload/one

"use strict";

var walk = require('walk');
var fs = require('fs');
var path = require("path");

var namespace_tree = {};

function addToTree(tree, array, filename) { 
   for (var i = 0, length = array.length; i < length; i++) {
   		if(!tree[array[i]]) {
   			tree[array[i-1]].files = tree[array[i-1]].files | [];
			tree[array[i-1]].files.push(filename);
   		}
       //tree[array[i]] = tree[array[i]] || {}
       tree = tree[array[i]]
   }
}

var options = {
	listeners: {
		//followLinks: false,

		file: function (root, fileStats, next) {

			var suffix = ".js";

			var namespace_regex = /^\/\/namespace\s(((\/(\w+))+)|(\/{1}))/i

			if (fileStats.name.indexOf(suffix, fileStats.name.length - suffix.length) !== -1) {

				 fs.readFile(path.join(root, fileStats.name), {encoding: 'utf-8'},  function (err, data) {

				 	var namespace = data.match(namespace_regex);

				 	if (namespace !== null) {
				 		var namespace_arr = namespace[1].split('/').splice(1);

				 		addToTree(namespace_tree, namespace_arr, fileStats.name);
				 		console.log(namespace_tree);

				 	}

				 	//next();
				 });
			} else {
				//next();
			}


		},
		errors: function (root, nodeStatsArray, next) {
			next();
		}
	}
};

function autoload(dir) {
	walk.walkSync(dir, options);
}

module.exports = autoload;