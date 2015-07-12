var redis = require('./test/lib/redis-process');

module.exports = function (grunt) {
    var redisProcess;

    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        mochaTest: {
            tests: {
                options: {
                    reporter: 'spec',
                    timeout: 10000
                },
                src: ['test/mocha/**/*.spec.js']
            }
        }
    });

    grunt.registerTask('start', function () {
        var done = this.async();
        redisProcess = redis.start(done);
    });

    grunt.registerTask('stop', function () {
        if (redisProcess) {
            redisProcess.stop();
            redisProcess = null;
        }
    });

    grunt.registerTask('mocha-tests', 'Run the Mocha tests', ['mochaTest:tests']);

    grunt.registerTask('run-tests', [
        'start',
        'mocha-tests',
        'stop'
    ]);
};
