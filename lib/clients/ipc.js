'use strict';

const Os = require('os');
const Insync = require('insync');


module.exports = Ipc;


function Ipc () {
  this.reporters = [];
  this._client = typeof process.send === 'function' ? noop : null;

  process.on('disconnected', () => {
    process.exit(0);
  });
}

Ipc.prototype.write = function write (data, callback) {
  if (typeof callback !== 'function') {
    callback = noop;
  }

  if (typeof process.send !== 'function') {
    return callback();
  }

  process.send(data, callback);
};

Ipc.prototype.connect = function connect (commands, handler, callback) {
  const info = {
    pid: process.pid,
    argv: process.argv,
    version: process.version,
    hostname: Os.hostname()
  };

  process.on('message', (message) => {
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
  if (typeof callback !== 'function') {
    callback = noop;
  }

  Insync.each(this.reporters, (reporter, next) => {
    reporter.report(message, next);
  }, callback);
};


function noop () {}
