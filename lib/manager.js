'use strict';

const Insync = require('insync');
const Own2Json = require('own2json');
const Client = require('./client');

const errorPolicyMap = {
  'swallow': noop,
  'log': logError,
  'log-verbose': logVerboseError,
  'throw': throwError,
  'terminate': terminateOnError
};


module.exports = Manager;


function Manager (options) {
  this._cmds = new Map();
  this.error = errorPolicyMap[options.errors.policy.toLowerCase()];
  this.client = new Client(this);
}


Manager.prototype.add = function add (name, fn) {
  this._cmds.set(name, fn);
};


Manager.prototype.list = function list () {
  const commands = [];
  for (const cmd of this._cmds.keys()) {
    commands.push(cmd);
  }
  return commands;
};


Manager.prototype.register = function register (plugins, callback) {
  const self = this;

  plugins = [].concat(plugins);

  Insync.each(plugins, function iterator (obj, cb) {
    const plugin = obj.plugin;
    const options = obj.options || {};

    plugin.register(self, options, cb);
  }, callback);
};


Manager.prototype.execute = function execute (message) {
  const client = this.client;
  const cmd = this._cmds.get(message.command);

  if (typeof cmd !== 'function') {
    const err = new Error(`unknown command ${message.command}`);
    err.toJSON = Own2Json;
    return respond(client,
                   'command-error',
                   message.command,
                   err);
  }

  cmd(message.options || {}, function executeCb (err, results) {
    if (err) {
      err.toJSON = Own2Json;
      return respond(client, 'command-error', message.command, err);
    }

    if (results) {
      respond(client, 'command-result', message.command, results);
    }
  });
};


function noop () {}


function logError (err) {
  console.error(`toolbag: ${err.message}`);
}


function logVerboseError (err) {
  console.error(`toolbag: ${err.stack}`);
}


function throwError (err) {
  throw err;
}


function terminateOnError (err) {
  logVerboseError(err);
  process.exit(1);
}


function respond (client, command, responseTo, data) {
  client.respond({
    command,
    payload: {
      type: responseTo,
      data: data
    }
  });
}
