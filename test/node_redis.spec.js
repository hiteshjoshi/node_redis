var async = require("async");
var assert = require("assert");
var config = require("./lib/config");
var fork = require("child_process").fork;
var nodeAssert = require("./lib/nodeify-assertions");
var redis = config.redis;

describe("A node_redis client", function () {

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);

        describe("using " + parser + " and " + ip, function () {
            var client;

            describe("when not connected", function () {
                afterEach(function () {
                    client.end();
                });

                it("connects correctly", function (done) {
                    client = redis.createClient.apply(redis.createClient, args);
                    client.on("error", done);

                    client.once("ready", function () {
                        client.removeListener("error", done);
                        client.get("recon 1", function (err, res) {
                            done(err);
                        });
                    });
                });
            });

            describe("when connected", function () {
                beforeEach(function (done) {
                    client = redis.createClient.apply(redis.createClient, args);
                    client.once("error", done);
                    client.once("connect", function () {
                        client.flushdb(done)
                    });
                });

                afterEach(function () {
                    client.end();
                });

                describe("when redis closes unexpectedly", function () {
                    it("reconnects and can retrieve the pre-existing data", function (done) {
                        client.on("reconnecting", function on_recon(params) {
                            client.on("connect", function on_connect() {
                                async.parallel([function (cb) {
                                    client.get("recon 1", function (err, res) {
                                        nodeAssert.isString("one")(err, res);
                                        cb();
                                    });
                                }, function (cb) {
                                    client.get("recon 1", function (err, res) {
                                        nodeAssert.isString("one")(err, res);
                                        cb();
                                    });
                                }, function (cb) {
                                    client.get("recon 2", function (err, res) {
                                        nodeAssert.isString("two")(err, res);
                                        cb();
                                    });
                                }, function (cb) {
                                    client.get("recon 2", function (err, res) {
                                        nodeAssert.isString("two")(err, res);
                                        cb();
                                    });
                                }], function (err, results) {
                                    client.removeListener("connect", on_connect);
                                    client.removeListener("reconnecting", on_recon);
                                    done(err);
                                });
                            });
                        });

                        client.set("recon 1", "one");
                        client.set("recon 2", "two", function (err, res) {
                            // Do not do this in normal programs. This is to simulate the server closing on us.
                            // For orderly shutdown in normal programs, do client.quit()
                            client.stream.destroy();
                        });
                    });

                    describe("and it's subscribed to a channel", function () {
                        // reconnect_select_db_after_pubsub
                        // Does not pass.
                        // "Connection in subscriber mode, only subscriber commands may be used"
                        xit("reconnects, unsubscribes, and can retrieve the pre-existing data", function (done) {
                            client.on("reconnecting", function on_recon(params) {
                                client.on("ready", function on_connect() {
                                    async.parallel([function (cb) {
                                        client.unsubscribe("recon channel", function (err, res) {
                                            nodeAssert.isNotError()(err, res);
                                            cb();
                                        });
                                    }, function (cb) {
                                        client.get("recon 1", function (err, res) {
                                            nodeAssert.isString("one")(err, res);
                                            cb();
                                        });
                                    }], function (err, results) {
                                        client.removeListener("connect", on_connect);
                                        client.removeListener("reconnecting", on_recon);
                                        done(err);
                                    });
                                });
                            });

                            client.set("recon 1", "one");
                            client.subscribe("recon channel", function (err, res) {
                                // Do not do this in normal programs. This is to simulate the server closing on us.
                                // For orderly shutdown in normal programs, do client.quit()
                                client.stream.destroy();
                            });
                        });

                        it("remains subscribed", function () {
                            var client2 = redis.createClient.apply(redis.createClient, args);

                            client.on("reconnecting", function on_recon(params) {
                                client.on("ready", function on_connect() {
                                    async.parallel([function (cb) {
                                        client.on("message", function (channel, message) {
                                            try {
                                                nodeAssert.isString("recon channel")(null, channel);
                                                nodeAssert.isString("a test message")(null, message);
                                            } catch (err) {
                                                cb(err);
                                            }
                                        });

                                        client2.subscribe("recon channel", function (err, res) {
                                            if (err) {
                                                cb(err);
                                                return;
                                            }
                                            client2.publish("recon channel", "a test message");
                                        });
                                    }], function (err, results) {
                                        done(err);
                                    });
                                });
                            });

                            client.subscribe("recon channel", function (err, res) {
                                // Do not do this in normal programs. This is to simulate the server closing on us.
                                // For orderly shutdown in normal programs, do client.quit()
                                client.stream.destroy();
                            });
                        });
                    });
                });

                it('emits errors thrown from within an on("message") handler', function (done) {
                    var client2 = redis.createClient.apply(redis.createClient, args);
                    var name = 'channel';

                    client2.subscribe(name, function () {
                        client.publish(name, "some message");
                    });

                    client2.on("message", function (channel, data) {
                        if (channel == name) {
                            assert.equal(data, "some message");
                            throw Error('forced exception');
                        }
                        return done();
                    });

                    client2.once("error", function (err) {
                        client2.end();
                        assert.equal(err.message, 'forced exception');
                        return done();
                    });
                });

                describe('idle', function () {
                    it('emits idle as soon as there are no outstanding commands', function (done) {
                        client.on('idle', function onIdle () {
                            client.removeListener("idle", onIdle);
                            client.get('foo', nodeAssert.isString('bar', done));
                        });
                        client.set('foo', 'bar');
                    });
                });
            });

            describe('detect_buffers', function () {
                var client;
                var args = config.configureClient(parser, ip, {
                    detect_buffers: true
                });

                beforeEach(function (done) {
                    client = redis.createClient.apply(redis.createClient, args);
                    client.once("error", done);
                    client.once("connect", function () {
                        client.flushdb(function (err) {
                            client.hmset("hash key 2", "key 1", "val 1", "key 2", "val 2");
                            client.set("string key 1", "string value");
                            return done(err);
                        });
                    });
                });

                describe('get', function () {
                    describe('first argument is a string', function () {
                        it('returns a string', function (done) {
                            client.get("string key 1", nodeAssert.isString("string value", done));
                        });

                        it('returns a string when executed as part of transaction', function (done) {
                            client.multi().get("string key 1").exec(nodeAssert.isString("string value", done));
                        });
                    });

                    describe('first argument is a buffer', function () {
                        it('returns a buffer', function (done) {
                            client.get(new Buffer("string key 1"), function (err, reply) {
                                assert.strictEqual(true, Buffer.isBuffer(reply));
                                assert.strictEqual("<Buffer 73 74 72 69 6e 67 20 76 61 6c 75 65>", reply.inspect());
                                return done(err);
                            });
                        });

                        it('returns a bufffer when executed as part of transaction', function (done) {
                            client.multi().get(new Buffer("string key 1")).exec(function (err, reply) {
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual(true, Buffer.isBuffer(reply[0]));
                                assert.strictEqual("<Buffer 73 74 72 69 6e 67 20 76 61 6c 75 65>", reply[0].inspect());
                                return done(err);
                            });
                        });
                    });
                });

                describe('multi.hget', function () {
                    it('can interleave string and buffer results', function (done) {
                        client.multi()
                            .hget("hash key 2", "key 1")
                            .hget(new Buffer("hash key 2"), "key 1")
                            .hget("hash key 2", new Buffer("key 2"))
                            .hget("hash key 2", "key 2")
                            .exec(function (err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(4, reply.length);
                                assert.strictEqual("val 1", reply[0]);
                                assert.strictEqual(true, Buffer.isBuffer(reply[1]));
                                assert.strictEqual("<Buffer 76 61 6c 20 31>", reply[1].inspect());
                                assert.strictEqual(true, Buffer.isBuffer(reply[2]));
                                assert.strictEqual("<Buffer 76 61 6c 20 32>", reply[2].inspect());
                                assert.strictEqual("val 2", reply[3]);
                                return done(err);
                            });
                    });
                });

                describe('hmget', function () {
                    describe('first argument is a string', function () {
                        it('returns strings for keys requested', function (done) {
                            client.hmget("hash key 2", "key 1", "key 2", function (err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(2, reply.length);
                                assert.strictEqual("val 1", reply[0]);
                                assert.strictEqual("val 2", reply[1]);
                                return done(err);
                            });
                        });

                        it('returns strings for keys requested in transaction', function (done) {
                            client.multi().hmget("hash key 2", "key 1", "key 2").exec(function (err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual(2, reply[0].length);
                                assert.strictEqual("val 1", reply[0][0]);
                                assert.strictEqual("val 2", reply[0][1]);
                                return done(err);
                            });
                        });

                        it('handles array of strings with undefined values (repro #344)', function (done) {
                            client.hmget("hash key 2", "key 3", "key 4", function(err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(2, reply.length);
                                assert.equal(null, reply[0]);
                                assert.equal(null, reply[1]);
                                return done(err);
                            });
                        });

                        it('handles array of strings with undefined values in transaction (repro #344)', function (done) {
                            client.multi().hmget("hash key 2", "key 3", "key 4").exec(function(err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual(2, reply[0].length);
                                assert.equal(null, reply[0][0]);
                                assert.equal(null, reply[0][1]);
                                return done(err);
                            });
                        });
                    });

                    describe('first argument is a buffer', function () {
                        it('returns buffers for keys requested', function (done) {
                            client.hmget(new Buffer("hash key 2"), "key 1", "key 2", function (err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(2, reply.length);
                                assert.strictEqual(true, Buffer.isBuffer(reply[0]));
                                assert.strictEqual(true, Buffer.isBuffer(reply[1]));
                                assert.strictEqual("<Buffer 76 61 6c 20 31>", reply[0].inspect());
                                assert.strictEqual("<Buffer 76 61 6c 20 32>", reply[1].inspect());
                                return done(err);
                            });
                        });

                        it("returns buffers for keys requested in transaction", function (done) {
                            client.multi().hmget(new Buffer("hash key 2"), "key 1", "key 2").exec(function (err, reply) {
                                assert.strictEqual(true, Array.isArray(reply));
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual(2, reply[0].length);
                                assert.strictEqual(true, Buffer.isBuffer(reply[0][0]));
                                assert.strictEqual(true, Buffer.isBuffer(reply[0][1]));
                                assert.strictEqual("<Buffer 76 61 6c 20 31>", reply[0][0].inspect());
                                assert.strictEqual("<Buffer 76 61 6c 20 32>", reply[0][1].inspect());
                                return done(err);
                            });
                        });
                    });
                });

                describe('hgetall', function (done) {
                    describe('first argument is a string', function () {
                        it('returns string values', function (done) {
                            client.hgetall("hash key 2", function (err, reply) {
                                assert.strictEqual("object", typeof reply);
                                assert.strictEqual(2, Object.keys(reply).length);
                                assert.strictEqual("val 1", reply["key 1"]);
                                assert.strictEqual("val 2", reply["key 2"]);
                                return done(err);
                            });
                        });

                        it('returns string values when executed in transaction', function (done) {
                            client.multi().hgetall("hash key 2").exec(function (err, reply) {
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual("object", typeof reply[0]);
                                assert.strictEqual(2, Object.keys(reply[0]).length);
                                assert.strictEqual("val 1", reply[0]["key 1"]);
                                assert.strictEqual("val 2", reply[0]["key 2"]);
                                return done(err);
                            });
                        });
                    });

                    describe('first argument is a buffer', function () {
                        it('returns buffer values', function (done) {
                            client.hgetall(new Buffer("hash key 2"), function (err, reply) {
                                assert.strictEqual(null, err);
                                assert.strictEqual("object", typeof reply);
                                assert.strictEqual(2, Object.keys(reply).length);
                                assert.strictEqual(true, Buffer.isBuffer(reply["key 1"]));
                                assert.strictEqual(true, Buffer.isBuffer(reply["key 2"]));
                                assert.strictEqual("<Buffer 76 61 6c 20 31>", reply["key 1"].inspect());
                                assert.strictEqual("<Buffer 76 61 6c 20 32>", reply["key 2"].inspect());
                                return done(err);
                            });
                        });

                        it('returns buffer values when executed in transaction', function (done) {
                            client.multi().hgetall(new Buffer("hash key 2")).exec(function (err, reply) {
                                assert.strictEqual(1, reply.length);
                                assert.strictEqual("object", typeof reply);
                                assert.strictEqual(2, Object.keys(reply[0]).length);
                                assert.strictEqual(true, Buffer.isBuffer(reply[0]["key 1"]));
                                assert.strictEqual(true, Buffer.isBuffer(reply[0]["key 2"]));
                                assert.strictEqual("<Buffer 76 61 6c 20 31>", reply[0]["key 1"].inspect());
                                assert.strictEqual("<Buffer 76 61 6c 20 32>", reply[0]["key 2"].inspect());
                                return done(err);
                            });
                        });
                    });
                });
            });

            describe('unref', function () {
                it('exits subprocess as soon as final command is processed', function (done) {
                    var args = config.HOST[ip] ? [config.HOST[ip], config.PORT] : [ip];
                    var external = fork("./test/lib/unref.js", args);
                    var id = setTimeout(function () {
                        external.kill();
                        return done(Error('unref subprocess timed out'));
                    }, 5000);

                    external.on("close", function (code) {
                        clearTimeout(id);
                        assert.strictEqual(code, 0);
                        return done();
                    });
                });
            });

            describe('socket_nodelay', function () {
                describe('true', function () {
                    var client;
                    var args = config.configureClient(parser, ip, {
                        socket_nodelay: true
                    });

                    it("fires client.on('ready')", function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(true, client.options.socket_nodelay);
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });

                    it('client is functional', function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(true, client.options.socket_nodelay);
                            client.set(["set key 1", "set val"], nodeAssert.isString("OK"));
                            client.set(["set key 2", "set val"], nodeAssert.isString("OK"));
                            client.get(["set key 1"], nodeAssert.isString("set val"));
                            client.get(["set key 2"], nodeAssert.isString("set val"));
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });
                });

                describe('false', function () {
                    var client;
                    var args = config.configureClient(parser, ip, {
                        socket_nodelay: false
                    });

                    it("fires client.on('ready')", function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(false, client.options.socket_nodelay);
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });

                    it('client is functional', function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(false, client.options.socket_nodelay);
                            client.set(["set key 1", "set val"], nodeAssert.isString("OK"));
                            client.set(["set key 2", "set val"], nodeAssert.isString("OK"));
                            client.get(["set key 1"], nodeAssert.isString("set val"));
                            client.get(["set key 2"], nodeAssert.isString("set val"));
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });
                });

                describe('defaults to true', function () {
                    var client;
                    var args = config.configureClient(parser, ip);

                    it("fires client.on('ready')", function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(true, client.options.socket_nodelay);
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });

                    it('client is functional', function (done) {
                        client = redis.createClient.apply(redis.createClient, args);
                        client.on("ready", function () {
                            assert.strictEqual(true, client.options.socket_nodelay);
                            client.set(["set key 1", "set val"], nodeAssert.isString("OK"));
                            client.set(["set key 2", "set val"], nodeAssert.isString("OK"));
                            client.get(["set key 1"], nodeAssert.isString("set val"));
                            client.get(["set key 2"], nodeAssert.isString("set val"));
                            client.quit();

                            client.once('end', function () {
                                return done();
                            });
                        });
                    });
                });
            });
        });
    }

    ['javascript', 'hiredis'].forEach(function (parser) {
        allTests(parser, "/tmp/redis.sock");
        ['IPv4', 'IPv6'].forEach(function (ip) {
            allTests(parser, ip);
        });
    });
});
