'use strict';

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var winston = require('winston');
var config = require('./config').config;

console.log('listening on port ' + config.port);
server.listen(config.port);

var jsonfile = require(config.contentBase + config.file);
var id = jsonfile['lastid'];
var graph = jsonfile['graph'];
var chat = jsonfile['chat'];

console.log('starting with chat :', chat);

function handleError(error, res) {
  if (res) {
      res.send(500, {error: error});
      winston.log('res: ', res);
  }

  winston.log('error', error.toString());
}

setInterval(function() {
    fs.writeFile(
	config.contentBase + config.file,
	JSON.stringify({ 'lastid': id, 'graph': graph, 'chat': chat })
    );

    var exec = require('child_process').exec;
    var message = '"' + new Date() + '"';
    var cleanmsg = 'On branch master\nnothing to commit, working directory clean\n';

    var test = exec(
	// navigate to content directory
	'cd ' + config.contentBase + '; ' +
	    // check status of git repo
	    'git status; ', function (err, stdout, stderr) {
		if (stdout !== cleanmsg) {
		    // only if we have changes, then commit them
		    commit();
		}
	    });

    function commit () {
	exec(
	    'cd ' + config.contentBase + '; ' +
		'git commit -a -m ' + message + '; ',
	    function (error, stdout, stderr) {
		console.log('made a commit on ' + new Date());
		if (stderr) {
		    return handleError(stderr);
		}
		if (error) {
		    return handleError(error);
		}
	    }
	);
    }

}, config.commitInterval); // git commit on interval

var users = 0;
io.on('connection', function (socket) {
    console.log('gained a connection');
    users++;
    io.emit('usercount', users);

    socket.emit('graph', graph);
    socket.emit('chat', chat);
    // when a new user connects, send existing graph and chat

    socket.on('temp id', function (data) {
	socket.emit('new id', {tempId: data.tempId, id: id++});
    }); // to sender only

    socket.on('graph', function (data) {
	socket.broadcast.emit('graph', data);
	graph = data;
    }); // to all except sender

    socket.on('chat', function (data) {
	socket.broadcast.emit('chat', data);
	chat = data;
    }); // to all except sender 

    socket.on('disconnect', function () {
        console.log('lost a connection');
	users--;
	io.emit('usercount', users);
    });
});
