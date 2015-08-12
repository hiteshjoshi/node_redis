var assert = require("assert");
var config = require("../lib/config");
var nodeAssert = require("../lib/nodeify-assertions");
var redis = config.redis;

describe("The 'type' method", function () {

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

            it('reports string type', function (done) {
                client.set(["string key", "should be a string"], nodeAssert.isString("OK"));
                client.TYPE(["string key"], nodeAssert.isString("string", done));
            });

            it('reports list type', function (done) {
                client.rpush(["list key", "should be a list"], nodeAssert.isNumber(1));
                client.TYPE(["list key"], nodeAssert.isString("list", done));
            });

            it('reports set type', function (done) {
                client.sadd(["set key", "should be a set"], nodeAssert.isNumber(1));
                client.TYPE(["set key"], nodeAssert.isString("set", done));
            });

            it('reports zset type', function (done) {
                client.zadd(["zset key", "10.0", "should be a zset"], nodeAssert.isNumber(1));
                client.TYPE(["zset key"], nodeAssert.isString("zset", done));
            });

            it('reports hash type', function (done) {
                client.hset(["hash key", "hashtest", "should be a hash"], nodeAssert.isNumber(1));
                client.TYPE(["hash key"], nodeAssert.isString("hash", done));
            });

            it('reports none for null key', function (done) {
                client.TYPE("not here yet", nodeAssert.isString("none", done));
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
