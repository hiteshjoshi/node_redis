var assert = require("assert");
var config = require("../lib/config");
var nodeAssert = require("../lib/nodeify-assertions");
var redis = config.redis;

describe("The 'rename' method", function () {

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

            it('populates the new key', function (done) {
                client.set(['foo', 'bar'], nodeAssert.isString("OK"));
                client.RENAME(["foo", "new foo"], nodeAssert.isString("OK"));
                client.exists(["new foo"], nodeAssert.isNumber(1, done));
            });

            it('removes the old key', function (done) {
                client.set(['foo', 'bar'], nodeAssert.isString("OK"));
                client.RENAME(["foo", "new foo"], nodeAssert.isString("OK"));
                client.exists(["foo"], nodeAssert.isNumber(0, done));
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
