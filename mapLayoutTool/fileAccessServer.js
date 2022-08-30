#! /usr/bin/env node

const Express = require('express');
const {Server} = require('socket.io');
const http = require('http');
const fs = require('fs');

const HTTP_PORT = 4000;

const app = new Express;
const httpserver = http.createServer(this.app);
const io = new Server(httpserver, {
	cors: {
		origin: "http://localhost:3001"
	}
});
let iosocket = null;

/*************
 * loadComms
 * Starts Express game server, http port listening, io listening, and sets iosocket for communicating with client.
 ************/
function loadComms() {
	app.get('/', (req, res) => {
		res.send('File access backend server started');
	});

	httpserver.listen(HTTP_PORT, () => console.log(`File access server listening on port ${HTTP_PORT}!`));

	io.on('connection', (socket) => {
		console.log('connected to client');

		iosocket = socket;

		initListeners();
	});
	io.on('disconnect', () => {
		console.log('disconnected from client');
	});
}

function initListeners() {
	iosocket.on('load-pieces', () => {
		fs.readFile('mapData.json', 'utf8', (err, data) => {
			if (err) {
				console.log(err)
			} else {
				iosocket.emit('sending-pieces', data);
			}
		});
	});
	iosocket.on('save-map-data', (data) => {
		fs.writeFile('mapData.json', data, err => {
			if (err) {
				console.log(err)
			} else {
				iosocket.emit('data-saved');
			}
		});
	});
}

loadComms();
