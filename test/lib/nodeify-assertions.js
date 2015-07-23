var assert = require('assert');

module.exports = {
    isNumber: function (expected, done) {
        return function (err, results) {
            assert.strictEqual(null, err, "expected " + expected + ", got error: " + err);
            assert.strictEqual(expected, results, expected + " !== " + results);
            assert.strictEqual(typeof results, "number", "expected a number, got " + typeof results);
            if (done) return done();
        };
    },

    isString: function (str, done) {
        return function (err, results) {
            assert.strictEqual(null, err, "expected string '" + str + "', got error: " + err);
            assert.equal(str, results, str + " does not match " + results);
            if (done) return done();
        };
    },

    isNull: function (done) {
        return function (err, results) {
            assert.strictEqual(null, err, "expected null, got error: " + err);
            assert.strictEqual(null, results, results + " is not null");
            if (done) return done();
        };
    },

    isError: function (done) {
        return function (err, results) {
            assert.notEqual(err, null, "err is null, but an error is expected here.");
            if (done) return done();
        };
    },

    isNotError: function (done) {
        return function (err, results) {
            assert.strictEqual(err, null, "expected success, got an error: " + err);
            if (done) return done();
        };
    },

    isType: {
        number: function (done) {
            return function (err, results) {
                assert.strictEqual(null, err, "expected any number, got error: " + err);
                assert.strictEqual(typeof results, "number", results + " is not a number");
                if (done) return done();
            };
        },

        positiveNumber: function (done) {
            return function (err, results) {
                assert.strictEqual(null, err, "expected positive number, got error: " + err);
                assert.strictEqual(true, (results > 0), results + " is not a positive number");
                if (done) return done();
            };
        }
    },

    serverVersionAtLeast: function (connection, desired_version) {
        // Return true if the server version >= desired_version
        var version = connection.server_info.versions;
        for (var i = 0; i < 3; i++) {
            if (version[i] > desired_version[i]) return true;
            if (version[i] < desired_version[i]) return false;
        }
        return true;
    }
};
