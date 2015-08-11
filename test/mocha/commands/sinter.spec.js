var assert = require("assert");
var config = require("../../lib/config");
var crypto = require("crypto");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'sinter' method", function () {

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

            it('handles two sets being intersected', function (done) {
                client.sadd('sa', 'a', nodeAssert.isNumber(1));
                client.sadd('sa', 'b', nodeAssert.isNumber(1));
                client.sadd('sa', 'c', nodeAssert.isNumber(1));

                client.sadd('sb', 'b', nodeAssert.isNumber(1));
                client.sadd('sb', 'c', nodeAssert.isNumber(1));
                client.sadd('sb', 'd', nodeAssert.isNumber(1));

                client.sinter('sa', 'sb', function (err, intersection) {
                    assert.equal(intersection.length, 2);
                    assert.deepEqual(intersection.sort(), [ 'b', 'c' ]);
                    return done(err);
                });
            });

            it('handles three sets being intersected', function (done) {
                client.sadd('sa', 'a', nodeAssert.isNumber(1));
                client.sadd('sa', 'b', nodeAssert.isNumber(1));
                client.sadd('sa', 'c', nodeAssert.isNumber(1));

                client.sadd('sb', 'b', nodeAssert.isNumber(1));
                client.sadd('sb', 'c', nodeAssert.isNumber(1));
                client.sadd('sb', 'd', nodeAssert.isNumber(1));

                client.sadd('sc', 'c', nodeAssert.isNumber(1));
                client.sadd('sc', 'd', nodeAssert.isNumber(1));
                client.sadd('sc', 'e', nodeAssert.isNumber(1));

                client.sinter('sa', 'sb', 'sc', function (err, intersection) {
                    assert.equal(intersection.length, 1);
                    assert.equal(intersection[0], 'c');
                    return done(err);
                });
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
