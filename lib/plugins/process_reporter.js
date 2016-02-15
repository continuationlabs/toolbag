'use strict';

const Merge = require('lodash.merge');


module.exports = { register };


function register (manager, options, callback) {
  const reporter = new ProcessReporter(options);

  manager.client.reporters.push(reporter);
  callback();
}


function ProcessReporter (options) {
  this._options = Merge({}, options);
}


ProcessReporter.prototype.report = function report (message, callback) {
  const settings = Merge({
    options: { message }
  }, this._options);

  if (typeof process.send !== 'function') {
    return callback();
  }

  process.send(settings.options, callback);
};
