'use strict';
const Code = require('code');
const Lab = require('lab');
const Own2Json = require('own2json');
const StandIn = require('stand-in');

const Manager = require('../lib/manager');
const Client = require('../lib/client');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;


describe('Manager', () => {
  it('creates a new Manager object', (done) => {
    const m = new Manager({ errors: { policy: 'swallow' } });
    expect(m._cmds).to.exist();
    expect(m.client).to.be.an.instanceof(Client);
    done();
  });

  it('add() can add new commands', (done) => {
    const m = new Manager({ errors: { policy: 'swallow' } });
    expect(m._cmds.keys()).to.have.length(0);
    m.add('test', () => { });
    m.add('test', () => { });
    expect(m._cmds.size).to.equal(1);
    done();
  });

  it('list() can list all of the available command names', (done) => {
    const m = new Manager({ errors: { policy: 'swallow' } });
    expect(m._cmds.keys()).to.have.length(0);
    m.add('test1', () => { });
    m.add('test2', () => { });
    m.add('test3', () => { });
    expect(m._cmds.size).to.equal(3);

    const result = m.list();
    expect(result).to.deep.equal(['test1', 'test2', 'test3']);
    done();
  });

  describe('register()', () => {
    it('calls the register() method of every plugin supplied', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      const plug1 = {
        plugin: {
          register (manager, options, callback) {
            setImmediate(() => {
              expect(manager).to.equal(m);
              expect(options).to.deep.equal({ foo: 'bar', bing: 'baz' });
              expect(callback).to.be.a.function();
              callback(null);
            });
          }
        },
        options: { foo: 'bar', bing: 'baz' }
      };
      const plug2 = {
        plugin: {
          register (manager, options, callback) {
            expect(manager).to.equal(m);
            expect(options).to.deep.equal({});
            expect(callback).to.be.a.function();
            callback(null);
          }
        }};

      m.register([plug1, plug2], done);
    });

    it('bubbles up any errors during registration', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      const plug1 = {
        plugin: {
          register (manager, options, callback) {
            setImmediate(() => {
              expect(manager).to.equal(m);
              expect(options).to.deep.equal({ foo: 'bar', bing: 'baz' });
              expect(callback).to.be.a.function();
              callback(new Error('test error'));
            });
          }
        },
        options: { foo: 'bar', bing: 'baz' }
      };

      m.register(plug1, (err) => {
        expect(err.message).to.equal('test error');
        done();
      });
    });
  });

  describe('execute()', () => {
    it('will respond with an error payload if the command is not available', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      m.client.respond = (message) => {
        expect(message.command).to.equal('command-error');
        expect(message.payload.type).to.equal('kill-9');
        expect(message.payload.data).to.be.an.instanceof(Error);
        expect(message.payload.data.stack.length).to.be.above(1);
        expect(message.payload.data.message).to.equal('unknown command kill-9');
        expect(message.payload.data.toJSON).to.equal(Own2Json);
        done();
      };
      m.execute({ command: 'kill-9', options: { now: true }});
    });
    it('will execute the command from the command map if found and pass any errors to through the callback', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      m.client.respond = (message) => {
        expect(message.command).to.equal('command-error');
        expect(message.payload.type).to.equal('test');
        expect(message.payload.data).to.be.an.instanceof(Error);
        expect(message.payload.data.stack.length).to.be.above(1);
        expect(message.payload.data.message).to.equal('test error');
        expect(message.payload.data.toJSON).to.equal(Own2Json);
        done();
      };

      m.add('test', (options, callback) => {
        expect(options).to.deep.equal({ foo: true });
        setImmediate(() => {
          callback(new Error('test error'));
        });
      });

      m.execute({ command: 'test', options: { foo: true } });
    });

    it('will execute the command from the command map if found', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      m.add('test', (options, callback) => {
        expect(options).to.deep.equal({});
        setImmediate(() => {
          callback(null);
        });
      });

      m.execute({ command: 'test' });
      done();
    });

    it('will execute the command from the command map if found and pass results through the callback', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      m.client.respond = (message) => {
        expect(message.command).to.equal('command-result');
        expect(message.payload.type).to.equal('test');
        expect(message.payload.data).to.equal('OK');
        done();
      };

      m.add('test', (options, callback) => {
        setImmediate(() => {
          callback(null, 'OK');
        });
      });

      m.execute({ command: 'test' });
    });
  });

  describe('error()', () => {
    it('"swallow" option discards errors', (done) => {
      const m = new Manager({ errors: { policy: 'swallow' } });
      m.error(new Error());
      done();
    });

    it('"log" option logs error messages to the stderr', (done) => {
      const m = new Manager({ errors: { policy: 'log' } });
      StandIn.replace(console, 'error', (s, message) => {
        s.restore();
        expect(message).to.equal('toolbag: test error');
        done();
      });
      m.error(new Error('test error'));
    });

    it('"log-verbose" option logs error stacks to the stderr', (done) => {
      const m = new Manager({ errors: { policy: 'log-verbose' } });
      StandIn.replace(console, 'error', (s, message) => {
        s.restore();
        expect(message.length).to.be.above(19); // toolbag: test error is only 19 characters
        done();
      });
      m.error(new Error('test error'));
    });

    it('"throw" option throws the error', (done) => {
      const m = new Manager({ errors: { policy: 'throw' } });
      expect(() => {
        m.error(new Error('test error'));
      }).to.throw(Error, 'test error');
      done();
    });

    it('"terminate" option exits the running process and logs verbose', (done) => {
      const m = new Manager({ errors: { policy: 'terminate' } });
      StandIn.replace(console, 'error', (s, message) => {
        s.restore();
        expect(message.length).to.be.above(19); // toolbag: test error is only 19 characters
      });
      StandIn.replace(process, 'exit', (s, code) => {
        s.restore();
        expect(code).to.equal(1);
        done();
      });
      m.error(new Error('test error'));
    });
  });
});
