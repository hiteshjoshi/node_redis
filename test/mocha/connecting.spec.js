var PORT = 6379;
var HOST = '127.0.0.1';
var parser = process.argv[3];

var redis = require("../../index");

describe("A node_redis client", function () {
    describe("using IPV4", function () {
        it("connects correctly", function (done) {
            var client = redis.createClient( PORT, HOST, { family : "IPv4", parser: parser } );
            client.on("error", done);

            client.once("ready", function start_tests() {
                client.removeListener("error", done);
                client.quit();
                done();
            });
        });
    });
});
