var async = require('async');
var assert = require('assert');
var config = require("../../lib/config");
var nodeAssert = require('../../lib/nodeify-assertions');
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");
var commands = require("../../../lib/commands");

// expected inputs and outputs for a
// sampling of redis commands.
var expectations = {
  append: {
    arguments: ['banana', 'phone'],
    assert: function (response) {
      assert.strictEqual(5, response)
    }
  },
  auth: {
    arguments: ['fakepass'],
    assertError: function (err) {
      assert.notEqual(err.message.indexOf('no password is set'), -1)
    }
  }
}

describe("The auto-generated methods", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        });
    })

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, config.configureClient(parser, ip));
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(function (err) {
                        return done(err);
                    });
                });
            });

            afterEach(function () {
                client.end();
            });

            commands.forEach(function (command) {
                var expected = expectations[command]
                if (!expected) return;

                var commandArgs = command.split(' ');
                var method = commandArgs.shift();
                [].push.apply(commandArgs, expectations[command].arguments)

                describe("the " + method + " method", function () {
                    it("calls sendCommand with whatever arguments it receives", function (done) {
                      commandArgs.push(function (err, response) {
                          if (expected.assert) expected.assert(response)
                          if (expected.assertError) expected.assertError(err)
                          return done();
                      })

                      client[method].apply(client, commandArgs);
                    });
                });
            });
        });
    }

    ['javascript', 'hiredis'].forEach(function (parser) {
        allTests(parser, "/tmp/redis.sock");
        ['IPv4', 'IPv6'].forEach(function (ip) {
            allTests(parser, ip);
        })
    });

    after(function (done) {
        if (rp) rp.stop(done);
    });
});
