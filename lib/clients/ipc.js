'use strict';

const Net = require('net');
const Os = require('os');
const Insync = require('insync');
const Split = require('split2');


module.exports = Ipc;


function Ipc () {
  this.reporters = [];
  this._client = process.env.NODE_CHANNEL_FD ? new Net.Socket({
    fd: process.env.NODE_CHANNEL_FD,
    readable: false,
    writable: true
  }) : noop;

  process.on('disconnected', () => {
    process.exit(0);
  });
}

Ipc.prototype.write = function write (data, callback) {
  if (typeof callback !== 'function') {
    callback = noop;
  }

  if (this._client === null || !this._client.write) {
    return callback();
  }

  const strData = (typeof data === 'string') ? data : JSON.stringify(data);
  this._client.write(strData + '\n', callback);
};

Ipc.prototype.connect = function connect (commands, handler, callback) {
  const info = {
    pid: process.pid,
    argv: process.argv,
    version: process.version,
    hostname: Os.hostname()
  };

  process.on('message', function (message) {
    let data = message;
    if (typeof message === 'string') {
      try {
        data = JSON.parse(message);
      }
      catch (err) {
        console.error(err);
        return;
      }
    }

    handler(data)
  });

  // Register with the parent process
  this.write({ path: 'register', payload: { commands, info } }, callback);
};


Ipc.prototype.respond = function respond (message, callback) {
  this.write({ path: 'respond', payload: message }, callback);
};


Ipc.prototype.report = function report (message, callback) {
  if (typeof message !== 'string') {
    message = JSON.stringify(message);
  }

  if (typeof callback !== 'function') {
    callback = noop;
  }

  Insync.each(this.reporters, function eachIterator (reporter, next) {
    reporter.report(message, next);
  }, callback);
};


function noop () {}
