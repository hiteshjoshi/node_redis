var path = require('path');
var RedisProcess = require("./lib/redis-process");
var rp;

before(function (done) {
    startRedis('./conf/redis.conf', done);
})

after(function (done) {
    if (rp) rp.stop(done);
});

module.exports = {
    stopRedis: function (done) {
        rp.stop(done);
    },
    startRedis: function (conf, done) {
        startRedis(conf, done);
    }
}

function startRedis (conf, done) {
    RedisProcess.start(function (err, _rp) {
        rp = _rp;
        return done(err);
    }, path.resolve(__dirname, conf));
}
