# toolbag

[![Current Version](https://img.shields.io/npm/v/toolbag.svg)](https://www.npmjs.org/package/toolbag)
[![Build Status via Travis CI](https://travis-ci.org/continuationlabs/toolbag.svg?branch=master)](https://travis-ci.org/continuationlabs/toolbag)
[![Dependencies](http://img.shields.io/david/continuationlabs/toolbag.svg)](https://david-dm.org/continuationlabs/toolbag#info=devDependencies)

[![belly-button-style](https://cdn.rawgit.com/continuationlabs/belly-button/master/badge.svg)](https://github.com/continuationlabs/belly-button)

`toolbag` is sponsored by [Continuation Labs](https://continuation.io/) and [nearForm](http://www.nearform.com/).

`toolbag` is a collection of tooling intended to be preloaded in a Node application. The tooling (heapdumps, CPU profiling, runtime metrics reporting, etc.) runs within an application's Node process. By utilizing preloading, `toolbag` does not require any modifications to existing application code. For example, if you normally start your application with the command `node app.js`, then your command would become:

```
node -r toolbag app.js
```

## Interfaces

`toolbag` exposes two interfaces. The first is the reporting interface, which is used to send runtime data to zero or more destinations. Analytics, logging, and similar types of systems represent the intended use cases of the reporting interface.

The second interface is the command interface. This interface allows a Node process to define commands which can be remotely invoked by a command server. This interface is intended to take heapdumps, collect CPU profiles, send signals to a running process, etc.

## Plugins

`toolbag` doesn't provide much functionality out of the box. However, it supports a plugin system for adding features. All reporters and command interface implementations are written as plugins. This allows `toolbag` to remain extremely simple, yet flexible enough to work with a variety of systems. For example, a WebSocket- or IPC-based command interface can be mixed and matched with HTTP or UDP reporters, without requiring any changes to `toolbag` itself.

## Configuration

`toolbag` is configured via a JavaScript file that is `require()`'ed at runtime. This file can be specified in exactly one of two ways:

1. By adding a `.toolbagrc.js` file to your project's working directory.
2. By specifying a `TOOLBAG_PATH` environment variable. This takes precedence over a local `.toolbagrc.js` file.

The configuration file should export a single function whose signature is `configure (defaults, callback)`. `defaults` contain the default configuration values set by `toolbag`. `callback` is a function with the signature `callback (err, config)`. `err` represents any error that might have occurred. `config` is an object that will be applied to `defaults`. The `config` object should adhere to the following schema.

  - `errors` (object) - Defines how `toolbag` errors are handled. Because `toolbag` is preloaded, normal applications are unable to handle any errors that may occur. These settings allow `toolbag` users to define an error handling policy. The `errors` object has the following schema.
    - `policy` (string) - Defines the error handling policy. Can be one of the following strings.
      - `swallow` - Errors are discarded.
      - `log` - Prints the error message to `stderr`. This is the default.
      - `log-verbose` - Prints the error message and stack trace to `stderr`.
      - `throw` - Throws the error.
      - `terminate` - Prints the error message and stack trace to `stderr` then calls `process.exit(1)`.
  - `data` (object) - Information regarding any persistent storage required by `toolbag`.
    - `path` (string) - The directory where files (such as heapdumps) are stored. Defaults to a `toolbag` directory in the system's temp directory.
  - `plugins` (array of objects) - An array of `toolbag` plugins to register. Each plugin object follows the following schema.
    - `plugin` (object) - The plugin being registered. This should be the result of `require()`.
    - `options` (object) - An optional object that is used to pass any plugin specific configuration options.

### Example `.toolbagrc.js` File

**Note:** A number of plugins are provided in the [`toolbag-plugins`](https://github.com/continuationlabs/toolbag-plugins), as shown in the following example. In the future, `toolbag-plugins` will be split up into a number of standalone npm modules.

```javascript
'use strict';

const ToolbagPlugins = require('toolbag-plugins');

module.exports = function config (defaults, callback) {
  callback(null, {
    errors: {
      policy: 'log'
    },
    plugins: [
      {
        plugin: ToolbagPlugins.BorlandCommander,
        options: {
          host: 'http://localhost:5000'
        }
      },
      {
        plugin: ToolbagPlugins.HttpReporter,
        options: {
          id: 'http reporter',
          method: 'POST',
          url: 'http://localhost:5000/report',
          options: {}
        }
      },
      {
        plugin: ToolbagPlugins.UdpReporter,
        options: {
          id: 'udp reporter',
          socketType: 'udp4',
          port: 5001,
          host: 'localhost'
        }
      },
      {
        plugin: ToolbagPlugins.Getfile,
        options: defaults.data
      },
      {
        plugin: ToolbagPlugins.Heapdump,
        options: defaults.data
      },
      {
        plugin: ToolbagPlugins.Profiler,
        options: defaults.data
      },
      { plugin: ToolbagPlugins.Signal },
      {
        plugin: ToolbagPlugins.StatsCollector,
        options: {
          enabled: true,
          period: 1000,
          eventLoopLimit: 30,
          features: {
            process: true,
            system: true,
            cpu: true,
            memory: true,
            gc: true,
            handles: true,
            requests: true,
            eventLoop: true,
            meta: {
              tags: ['api']
            }
          }
        }
      },
      {
        plugin: ToolbagPlugins.Policy,
        options: {
          blacklist: {
            modules: {
              fs: 'log'
            },
            bindings: {
              natives: 'log-verbose'
            }
          }
        }
      }
    ]
  });
};
```

## Running a Command Server

The command server is not mandatory, and is only required if you plan to use the command interface. As the command interface is defined via plugin, there is no predefined command server implementation. Instead command interface plugins should be developed in conjunction with a compatible server. An example is the [`borland`](https://github.com/continuationlabs/borland) hapi server plugin, and the borland commander plugin shown in the example `.toolbagrc.js` file.

## API

This section documents the APIs used to create `toolbag` plugins.

### The `Manager` Object

The manager responsible for general orchestration in `toolbag`. The manager registers plugins, implements the application's error policy, and handles other important tasks. Plugins are not expected to construct new instances of `Manager`. Instead, they should interact with the existing `manager` instance that is provided to them.

#### `add (name, fn)`

  - Arguments
    - `name` (string) - The name of the command being registered.
    - `fn (options, callback)` (function) - A function implementing the command being registered. `options` is an object used to pass parameters to the command. `callback ([err[, results]])` is used to pass an error or results from the command. If `err` is provided, it is sent back to the command server using `client.respond()`. If `err` is falsey, and `results` is provided, then it is sent back as the response.
  - Returns
    - Nothing

This method is used to register commands that can be used with the command interface.

#### `list ()`

  - Arguments
    - None
  - Returns
    - Array of strings

Returns an array of all commands supported by the manager.

#### `register (plugins[, callback])`

  - Arguments
    - `plugins` (object or array of objects) - An object or array of objects representing `toolbag` plugins.
    - `callback (err)` (function) - An optional function that is called once registration is complete. `err` represents any errors that may have occurred.
  - Returns
    - Nothing

This method registers one or more plugins.

#### `execute (message)`

  - Arguments
    - `message` (object) - An object encapsulating a command from the command server. The object should adhere to the following schema.
      - `command` (string) - The name of the command to execute.
      - `options` (object) - Options passed to the command.
  - Returns
    - Nothing

When a command is received on the command interface, it is passed to `execute()`. This method is responsible for running the command and sending any responses back to the server.

#### `error (err)`

  - Arguments
    - `err` (object) - An error object to process.
  - Returns
    - Nothing

This method is used to process `toolbag` errors. Because `toolbag` is preloaded, and not part of the user's application, `error()` is configurable. For example, in some applications, `error()` is configured to swallow errors, while other applications may choose to exit on error.

### The `Client` Object

The `Client` object is responsible for interacting with the command and reporting interfaces. Plugins are not expected to construct new instances of `Client`. Instead, they should interact with the existing `manager.client` instance.

#### `setCommander (commander)`

  - Arguments
    - `commander` (object) - An object that supports the command interface API.
  - Returns
    - Nothing

Sets up the command interface using `commander`.

#### `addReporter (reporter)`

- Arguments
  - `reporter` (object) - An object that supports the reporter API.
- Returns
  - Nothing

Adds `reporter` as a reporter.

#### `connect ([callback])`

  - Arguments
    - `callback (err)` (function) - Optional function that is invoked once connection is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

This method is used to establish a connection to the command server. If the command interface is configured during startup, `toolbag` will call this method after all plugins have been registered. If this method is called, and the command interface has not been configured, then an error will be passed to `callback()`.

#### `respond (message[, callback])`

  - Arguments
    - `message` (variable) - Data to send to the command server. If a non-string was passed in, it will be stringified before being passed on.
    - `callback (err)` (function) - Optional function that is invoked after responding is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

This method is used to respond to the command server after receiving and executing a command. If the command interface has not been configured, an error is passed to `callback()`.

#### `report (message[, callback])`

  - Arguments
    - `message` (variable) - Data to send via all attached reporters. If a non-string is passed in, it will be stringified before being passed on to the reporters.
    - `callback (err)` (function) - Optional function that is invoked after reporting is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

Sends data to all configured reporter destinations.

### Plugin API

All plugins must be capable of being imported into an application via `require()`. This means that plugins can easily be published to npm. Each plugin must expose a `register()` function that `toolbag` will invoke during plugin registration.

#### `register (manager, options, callback)`

  - Arguments
    - `manager` (object) - An instance of `Manager`.
    - `options` (variable) - Optional configuration data passed to the plugin.
    - `callback (err)` (function) - Invoked once registration is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

### Reporter API

A reporter can be added by calling `manager.client.addReporter(reporter)`, typically from within a plugin's `register()` function. Any number of reporters can be added, but keep in mind that excessive reporting can potentially affect application performance.

#### `report (message, callback)`

  - Arguments
    - `message` (string) - Message passed to the reporter from `client.report()`. If a non-string was passed to `client.report()`, it will be stringified before being passed on to this method.
    - `callback (err)` (function) - Invoked after reporting is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

All reporters must have a `report()` method. When `client.report()` is called, each reporter's `report()` method is called. This method is responsible for passing `message` to its destination.

### Command Interface API

`toolbag` supports a single command interface, which is setup by calling `manager.client.setCommander(commander)`. Implementers of the command interface must minimally define `connect()` and `respond()` methods.

#### `connect (manager, callback)`

  - Arguments
    - `manager` (object) - An instance of `Manager`.
    - `callback (err)` (function) - Invoked once connection is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

This method is used to establish a connection to the command server. If the command interface is configured during startup, `toolbag` will call this method after all plugins have been registered.

#### `respond (message, callback)`

  - Arguments
    - `message` (string) - Message passed to the command interface from `client.respond()`. If a non-string was passed to `client.respond()`, it will be stringified before being passed on to this method.
    - `callback (err)` (function) - Invoked after responding is complete. `err` represents any error that may have occurred.
  - Returns
    - Nothing

This method is used to respond to the command server after receiving and executing a command.
