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
 * Starts Express game server, http port listening, io listening, and io socket for communicating with client.
 ************/
function loadComms() {
	app.get('/', (req, res) => {
		res.send('Org backend server started');
	});

	httpserver.listen(HTTP_PORT, () => console.log(`File access server listening on port ${HTTP_PORT}!`));

	io.on('connection', (socket) => {
		console.log('connected to client');

		iosocket = socket;

		// initListeners();
	});
	io.on('disconnect', () => {
		console.log('disconnected');
	});
}

loadComms();
