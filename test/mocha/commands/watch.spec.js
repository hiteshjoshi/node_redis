var assert = require("assert");
var config = require("../../lib/config");
var crypto = require("crypto");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'watch' method", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        });
    })

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);
        var watched = 'foobar'

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, args);
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(function (err) {
                        if (!nodeAssert.serverVersionAtLeast(client, [2, 2, 0])) {
                          err = Error('some watch commands not supported in redis <= 2.2.0')
                        }
                        return done(err);

                    })
                });
            });

            afterEach(function () {
                client.end();
            });

            it('does not execute transaction if watched key was modified prior to execution', function (done) {
                client.watch(watched);
                client.incr(watched);
                multi = client.multi();
                multi.incr(watched);
                multi.exec(nodeAssert.isNull(done));
            })

            it('successfully modifies other keys independently of transaction', function (done) {
              client.set("unwatched", 200);

              client.set(watched, 0);
              client.watch(watched);
              client.incr(watched);

              var multi = client.multi()
                  .incr(watched)
                  .exec(function (err, replies) {
                      assert.strictEqual(replies, null, "Aborted transaction multi-bulk reply should be null.");

                      client.get("unwatched", function (err, reply) {
                          assert.equal(reply, 200, "Expected 200, got " + reply);
                          return done(err)
                      });
                  });
            })
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
