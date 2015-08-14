var assert = require("assert");
var config = require("../lib/config");
var nodeAssert = require("../lib/nodeify-assertions");
var redis = config.redis;

describe("The 'setnx' method", function () {

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, args);
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(done);
                });
            });

            it('sets key if it does not have a value', function (done) {
                client.setnx('foo', 'banana', nodeAssert.isNumber(1));
                client.get('foo', nodeAssert.isString('banana', done));
            });

            it('does not set key if it already has a value', function (done) {
                client.set('foo', 'bar', nodeAssert.isString('OK'));
                client.setnx('foo', 'banana', nodeAssert.isNumber(0));
                client.get('foo', nodeAssert.isString('bar', done));
                return done();
            });

            afterEach(function () {
                client.end();
            });
        });
    }

    ['javascript', 'hiredis'].forEach(function (parser) {
        allTests(parser, "/tmp/redis.sock");
        ['IPv4', 'IPv6'].forEach(function (ip) {
            allTests(parser, ip);
        })
    });
});
