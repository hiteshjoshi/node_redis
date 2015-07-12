var PORT = 6379;
var HOST = '127.0.0.1';
var parser = process.argv[3];

var redis = require("../../index");
var nodeAssert = require("../lib/nodeify-assertions");
var async = require("async");

describe("A node_redis client", function () {
    describe("using IPV4", function () {
        var client;

        after(function () {
            client.end();
        });

        it("connects correctly", function (done) {
            client = redis.createClient( PORT, HOST, { family : "IPv4", parser: parser } );
            client.on("error", done);

            client.once("ready", function start_tests() {
                client.removeListener("error", done);
                client.quit();
                done();
            });
        });
    });

    describe("when connected", function () {
        var client;

        before(function () {
            client = redis.createClient( PORT, HOST, { family : "IPv4", parser: parser } );
        });

        describe("when redis closes unexpectedly", function () {
            it("reconnects and can retrieve the pre-existing data", function (done) {
                client.on("reconnecting", function on_recon(params) {
                    client.on("connect", function on_connect() {
                        async.parallel([function (cb) {
                            client.get("recon 1", function (err, res) {
                                var a = nodeAssert.isString("one");
                                a(err, res);
                                cb();
                            });
                        }, function (cb) {
                            client.get("recon 1", function (err, res) {
                                var a = nodeAssert.isString("one");
                                a(err, res);
                                cb();
                            });
                        }, function (cb) {
                            client.get("recon 2", function (err, res) {
                                var a = nodeAssert.isString("two");
                                a(err, res);
                                cb();
                            });
                        }, function (cb) {
                            client.get("recon 2", function (err, res) {
                                var a = nodeAssert.isString("two");
                                a(err, res);
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
        });
    });
});
