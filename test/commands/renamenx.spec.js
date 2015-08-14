var assert = require("assert");
var config = require("../lib/config");
var nodeAssert = require("../lib/nodeify-assertions");
var redis = config.redis;

describe("The 'renamenx' method", function () {

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

            it('renames the key if target does not yet exist', function (done) {
                client.set('foo', 'bar', nodeAssert.isString('OK'));
                client.renamenx('foo', 'foo2', nodeAssert.isNumber(1));
                client.exists('foo', nodeAssert.isNumber(0));
                client.exists(['foo2'], nodeAssert.isNumber(1, done));
            });

            it('does not rename the key if the target exists', function (done) {
                client.set('foo', 'bar', nodeAssert.isString('OK'));
                client.set('foo2', 'apple', nodeAssert.isString('OK'));
                client.renamenx('foo', 'foo2', nodeAssert.isNumber(0));
                client.exists('foo', nodeAssert.isNumber(1));
                client.exists(['foo2'], nodeAssert.isNumber(1, done));
            })

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
