var assert = require("assert");
var config = require("../../lib/config");
var nodeAssert = require("../../lib/nodeify-assertions");
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");

describe("The 'eval' method", function () {

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
                    client.flushdb(function (err) {
                        return done(err);
                    })
                });
            });

            afterEach(function () {
                client.end();
            });

            it('converts a float to an integer when evaluated', function (done) {
                client.eval("return 100.5", 0, nodeAssert.isNumber(100, done));
            });

            it('returns a string', function (done) {
                client.eval("return 'hello world'", 0, nodeAssert.isString('hello world', done));
            });

            it('converts boolean true to integer 1', function (done) {
                client.eval("return true", 0, nodeAssert.isNumber(1, done));
            });

            it('converts boolean false to null', function (done) {
                client.eval("return false", 0, nodeAssert.isNull(done));
            });

            it('converts lua status code to string representation', function (done) {
                client.eval("return {ok='fine'}", 0, nodeAssert.isString('fine', done));
            });

            it('converts lua error to an error response', function (done) {
                client.eval("return {err='this is an error'}", 0, nodeAssert.isError(done));
            });

            it('represents a lua table appropritely', function (done) {
                client.eval("return {1,2,3,'ciao',{1,2}}", 0, function (err, res) {
                    assert.strictEqual(5, res.length);
                    assert.strictEqual(1, res[0]);
                    assert.strictEqual(2, res[1]);
                    assert.strictEqual(3, res[2]);
                    assert.strictEqual("ciao", res[3]);
                    assert.strictEqual(2, res[4].length);
                    assert.strictEqual(1, res[4][0]);
                    assert.strictEqual(2, res[4][1]);
                    return done();
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
