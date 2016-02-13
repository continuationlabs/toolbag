'use strict';

const Os = require('os');
const Path = require('path');
const Fse = require('fs-extra');
const Merge = require('lodash.merge');
const Clients = require('./clients');
const Manager = require('./manager');

const defaults = {
  client: {
    host: null
  },
  data: {
    path: Path.join(Os.tmpdir(), 'toolbag')
  },
  plugins: []
};


getConfig(defaults, function getConfigCb (err, config) {  // eslint-disable-line handle-callback-err
  const settings = Merge({}, defaults, config);
  const client = settings.client.host ? new Clients.WebSocket(settings.client) : new Clients.Ipc();
  const manager = new Manager({ client });

  Fse.ensureDirSync(settings.data.path);

  manager.register(settings.plugins, function registerCb (err) {
    if (err) {
      console.error(`toolbag: unable to register plugins - ${err.message}`);
      return;
    }

    // Only connect to borland if the user wants to use it
    if (client._client !== null) {
      client.connect(manager.list(), function messageHandler (message) {
        manager.execute(message);
      }, function connectCb (err) {
        if (err) {
          console.error(`toolbag: unable to connect to server - ${err.message}`);
          return;
        }
      });
    }
  });
});


function getConfig (defaults, callback) {
  try {
    const configPath = process.env.TOOLBAG_PATH || Path.join(process.cwd(), '.toolbagrc.js');
    const ConfigFn = require(configPath);

    ConfigFn(defaults, callback);
  } catch (err) {
    callback(err);
  }
}
