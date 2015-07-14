module.exports = (function () {
    var redis = require('../../index');
    redis.debug_mode = process.env.DEBUG ? JSON.parse(process.env.DEBUG) : false;

    return {
        redis: redis,
        PORT: 6378,
        HOST: {
            IPv4: "127.0.0.1",
            IPv6: "::1"
        }
    };
})();
