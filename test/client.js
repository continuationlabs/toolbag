'use strict';

const Code = require('code');
const Lab = require('lab');

const Client = require('../lib/client');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

describe('Client', () => {
  it('creates a new Client object', (done) => {
    const c = new Client();
    expect(c._reporters).to.deep.equal([]);
    expect(c._commander).to.be.null();
    done();
  });

  it('setCommander() can set the commander object', (done) => {
    const c = new Client();
    const commander = { foo: true };
    expect(c._commander).to.be.null();
    c.setCommander(commander);
    expect(c._commander).to.equal(commander);
    done();
  });

  it('addReporter() can add reporters to the reporters list', (done) => {
    const c = new Client();
    const reporter = { name: 'console' };
    expect(c._reporters).to.deep.equal([]);
    c.addReporter(reporter);
    expect(c._reporters).to.have.length(1);
    expect(c._reporters[0]).to.equal(reporter);
    done();
  });

  describe('connect()', () => {
    it('calls the _commanders connect method and executes the provided callback when done', (done) => {
      const c = new Client();
      const manager = {report () {}}; // eslint-disable-line no-unused-vars
      const commander = {
        connect (manager, callback) {
          expect(manager).to.equal(manager);
          expect(callback).to.be.a.function();
          callback();
        }
      };
      c.setCommander(commander);
      c.connect(done);
    });

    it('calls the _commanders connect method', (done) => {
      const c = new Client();
      const manager = {report () {}}; // eslint-disable-line no-unused-vars
      const commander = {
        connect (manager, callback) {
          expect(manager).to.equal(manager);
          expect(callback).to.be.a.function();
          done();
        }
      };
      c.setCommander(commander);
      c.connect();
    });
  });

  describe('respond()', () => {
    it('results in an error if there is no commander', (done) => {
      const c = new Client();
      c.respond(null, (err) => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('client not connected');
        done();
      });
    });

    it('results in an error if the message can not be stringify cleanly', (done) => {
      const c = new Client();
      c._commander = {};
      const message = { foo: true };
      message.bar = message;
      c.respond(message, (err) => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Converting circular structure to JSON: { foo: true, bar: [Circular] }');
        done();
      });
    });

    it('calls the respond() method of the commander object with a string message', (done) => {
      const c = new Client();
      c._commander = {
        respond (message, callback) {
          expect(message).to.equal('hello world');
          expect(callback).to.be.a.function();
          callback();
        }
      };
      c.respond('hello world', done);
    });

    it('calls the respond() method of the commander object with an object message', (done) => {
      const c = new Client();
      c._commander = {
        respond (message, callback) {
          message = JSON.parse(message);
          expect(message).to.deep.equal({ foo: 'bar' });
          expect(callback).to.be.a.function();
          done();
        }
      };
      c.respond({ foo: 'bar' });
    });
  });

  describe('report()', () => {
    it('results in an error if the message can not be stringify cleanly', (done) => {
      const c = new Client();
      const message = { foo: true };
      message.bar = message;
      c.report(message, (err) => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Converting circular structure to JSON: { foo: true, bar: [Circular] }');
        done();
      });
    });

    it('calls the report() method of all the reporters', (done) => {
      const c = new Client();
      const one = {
        report (message, callback) {
          message = JSON.parse(message);
          expect(message).to.deep.equal({ foo: 'bar' });
          callback();
        }
      };
      const two = {
        report (message, callback) {
          message = JSON.parse(message);
          expect(message).to.deep.equal({ foo: 'bar' });
          setImmediate(callback);
        }
      };
      const three = {
        report (message, callback) {
          expect(message).to.equal('hello world');
          callback();
        }
      };
      c._reporters = [one, two];
      c.report({ foo: 'bar' });
      c._reporters = [three];
      c.report('hello world', done);
    });
  });
});
