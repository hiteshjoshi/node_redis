var assert = require("assert");
var config = require("../../lib/config");
var crypto = require("crypto");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'del' method", function () {

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
                client = redis.createClient.apply(redis.createClient, args);
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(done);
                });
            });

            it('allows a single key to be deleted', function (done) {
                client.set('foo', 'bar');
                client.del('foo', nodeAssert.isNumber(1));
                client.get('foo', nodeAssert.isNull(done));
            });

            it('allows del to be called on a key that does not exist', function (done) {
                client.del('foo', nodeAssert.isNumber(0, done));
            });

            it('allows multiple keys to be deleted', function (done) {
                client.mset('foo', 'bar', 'apple', 'banana');
                client.del('foo', 'apple', nodeAssert.isNumber(2));
                client.get('foo', nodeAssert.isNull());
                client.get('apple', nodeAssert.isNull(done));
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

    after(function (done) {
      if (rp) rp.stop(done);
    });
});
