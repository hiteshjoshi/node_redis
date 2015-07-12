var cp = require('child_process');

module.exports = {
    start: function (done) {
        var process = cp.spawn("redis-server");

        process.once('err', done);
        process.stdout.once('data', function (data) {
            process.removeListener('err', done);
            done();
        });

        return {
            stop: function () {
                process.kill("SIGINT");
            }
        };
    },
};
