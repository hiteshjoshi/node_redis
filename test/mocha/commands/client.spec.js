var assert = require("assert");
var config = require("../../lib/config");
var crypto = require("crypto");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'client' method", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        });
    })

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);
        var pattern = /addr=/;

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, args);
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(function (err) {
                        if (!nodeAssert.serverVersionAtLeast(client, [2, 4, 0])) {
                          err = Error('script not supported in redis <= 2.4.0')
                        }
                        return done(err);

                    })
                });
            });

            afterEach(function () {
                client.end();
            });

            describe('list', function () {
                it('lists connected clients', function (done) {
                    client.client("list", nodeAssert.match(pattern, done));
                });

                it("lists connected clients when invoked with multi's chaining syntax", function (done) {
                    client.multi().client("list").exec(function(err, results) {
                        assert(pattern.test(results[0]), "expected string '" + results + "' to match " + pattern.toString());
                        return done()
                    })
                });

                it("lists connected clients when invoked with multi's array syntax", function (done) {
                    client.multi().client("list").exec(function(err, results) {
                        assert(pattern.test(results[0]), "expected string '" + results + "' to match " + pattern.toString());
                        return done()
                    })
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
