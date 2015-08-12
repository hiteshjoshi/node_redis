return;

'use strict';

/*global require console setTimeout process Buffer */
var PORT = process.env.REDIS_PORT_6379_TCP_PORT || 6379;
var HOST = process.env.REDIS_PORT_6379_TCP_ADDR || '127.0.0.1';
var parser = process.argv[3];

var redis = require("../index"),
    client = redis.createClient(PORT, HOST, { parser: parser }),
    client2 = redis.createClient(PORT, HOST, { parser: parser }),
    client3 = redis.createClient(PORT, HOST, { parser: parser }),
    bclient = redis.createClient(PORT, HOST, { return_buffers: true, parser: parser }),
    assert = require("assert"),
    crypto = require("crypto"),
    util = require("../lib/util"),
    fork = require("child_process").fork,
    test_db_num = 15, // this DB will be flushed and used for testing
    tests = {},
    connected = false,
    ended = false,
    next, cur_start, run_next_test, all_tests, all_start, test_count;

// Set this to truthy to see the wire protocol and other debugging info
redis.debug_mode = process.argv[2] ? JSON.parse(process.argv[2]) : false;

function server_version_at_least(connection, desired_version) {
    // Return true if the server version >= desired_version
    var version = connection.server_info.versions;
    for (var i = 0; i < 3; i++) {
        if (version[i] > desired_version[i]) return true;
        if (version[i] < desired_version[i]) return false;
    }
    return true;
}

function buffers_to_strings(arr) {
    return arr.map(function (val) {
        return val.toString();
    });
}

function require_number(expected, label) {
    return function (err, results) {
        assert.strictEqual(null, err, label + " expected " + expected + ", got error: " + err);
        assert.strictEqual(expected, results, label + " " + expected + " !== " + results);
        assert.strictEqual(typeof results, "number", label);
        return true;
    };
}

function require_number_any(label) {
    return function (err, results) {
        assert.strictEqual(null, err, label + " expected any number, got error: " + err);
        assert.strictEqual(typeof results, "number", label + " " + results + " is not a number");
        return true;
    };
}

function require_number_pos(label) {
    return function (err, results) {
        assert.strictEqual(null, err, label + " expected positive number, got error: " + err);
        assert.strictEqual(true, (results > 0), label + " " + results + " is not a positive number");
        return true;
    };
}

function require_string(str, label) {
    return function (err, results) {
        assert.strictEqual(null, err, label + " expected string '" + str + "', got error: " + err);
        assert.equal(str, results, label + " " + str + " does not match " + results);
        return true;
    };
}

function require_null(label) {
    return function (err, results) {
        assert.strictEqual(null, err, label + " expected null, got error: " + err);
        assert.strictEqual(null, results, label + ": " + results + " is not null");
        return true;
    };
}

function require_error(label) {
    return function (err, results) {
        assert.notEqual(err, null, label + " err is null, but an error is expected here.");
        return true;
    };
}

function is_empty_array(obj) {
    return Array.isArray(obj) && obj.length === 0;
}

function last(name, fn) {
    return function (err, results) {
        fn(err, results);
        next(name);
    };
}

// Wraps the given callback in a timeout. If the returned function
// is not called within the timeout period, we fail the named test.
function with_timeout(name, cb, millis) {
    var timeoutId = setTimeout(function() {
        assert.fail("Callback timed out!", name);
    }, millis);
    return function() {
        clearTimeout(timeoutId);
        cb.apply(this, arguments);
    };
}

next = function next(name) {
    console.log(" \x1b[33m" + (Date.now() - cur_start) + "\x1b[0m ms");
    run_next_test();
};

tests.RENAME = function () {
    var name = "RENAME";
    client.set(['foo', 'bar'], require_string("OK", name));
    client.RENAME(["foo", "new foo"], require_string("OK", name));
    client.exists(["foo"], require_number(0, name));
    client.exists(["new foo"], last(name, require_number(1, name)));
};

tests.RENAMENX = function () {
    var name = "RENAMENX";
    client.set(['foo', 'bar'], require_string("OK", name));
    client.set(['foo2', 'bar2'], require_string("OK", name));
    client.RENAMENX(["foo", "foo2"], require_number(0, name));
    client.exists(["foo"], require_number(1, name));
    client.exists(["foo2"], require_number(1, name));
    client.del(["foo2"], require_number(1, name));
    client.RENAMENX(["foo", "foo2"], require_number(1, name));
    client.exists(["foo"], require_number(0, name));
    client.exists(["foo2"], last(name, require_number(1, name)));
};


tests.MGET = function () {
    var name = "MGET";
    client.mset(["mget keys 1", "mget val 1", "mget keys 2", "mget val 2", "mget keys 3", "mget val 3"], require_string("OK", name));
    client.MGET("mget keys 1", "mget keys 2", "mget keys 3", function (err, results) {
        assert.strictEqual(null, err, "result sent back unexpected error: " + err);
        assert.strictEqual(3, results.length, name);
        assert.strictEqual("mget val 1", results[0].toString(), name);
        assert.strictEqual("mget val 2", results[1].toString(), name);
        assert.strictEqual("mget val 3", results[2].toString(), name);
    });
    client.MGET(["mget keys 1", "mget keys 2", "mget keys 3"], function (err, results) {
        assert.strictEqual(null, err, "result sent back unexpected error: " + err);
        assert.strictEqual(3, results.length, name);
        assert.strictEqual("mget val 1", results[0].toString(), name);
        assert.strictEqual("mget val 2", results[1].toString(), name);
        assert.strictEqual("mget val 3", results[2].toString(), name);
    });
    client.MGET(["mget keys 1", "some random shit", "mget keys 2", "mget keys 3"], function (err, results) {
        assert.strictEqual(null, err, "result sent back unexpected error: " + err);
        assert.strictEqual(4, results.length, name);
        assert.strictEqual("mget val 1", results[0].toString(), name);
        assert.strictEqual(null, results[1], name);
        assert.strictEqual("mget val 2", results[2].toString(), name);
        assert.strictEqual("mget val 3", results[3].toString(), name);
        next(name);
    });
};

tests.SETNX = function () {
    var name = "SETNX";
    client.set(["setnx key", "setnx value"], require_string("OK", name));
    client.SETNX(["setnx key", "new setnx value"], require_number(0, name));
    client.del(["setnx key"], require_number(1, name));
    client.exists(["setnx key"], require_number(0, name));
    client.SETNX(["setnx key", "new setnx value"], require_number(1, name));
    client.exists(["setnx key"], last(name, require_number(1, name)));
};

tests.SETEX = function () {
    var name = "SETEX";
    client.SETEX(["setex key", "100", "setex val"], require_string("OK", name));
    client.exists(["setex key"], require_number(1, name));
    client.ttl(["setex key"], last(name, require_number_pos(name)));
    client.SETEX(["setex key", "100", undefined], require_error(name));
};

tests.MSETNX = function () {
    var name = "MSETNX";
    client.mset(["mset1", "val1", "mset2", "val2", "mset3", "val3"], require_string("OK", name));
    client.MSETNX(["mset3", "val3", "mset4", "val4"], require_number(0, name));
    client.del(["mset3"], require_number(1, name));
    client.MSETNX(["mset3", "val3", "mset4", "val4"], require_number(1, name));
    client.exists(["mset3"], require_number(1, name));
    client.exists(["mset4"], last(name, require_number(1, name)));
};

tests.HGETALL = function () {
    var name = "HGETALL";
    client.hmset(["hosts", "mjr", "1", "another", "23", "home", "1234"], require_string("OK", name));
    client.HGETALL(["hosts"], function (err, obj) {
        assert.strictEqual(null, err, name + " result sent back unexpected error: " + err);
        assert.strictEqual(3, Object.keys(obj).length, name);
        assert.strictEqual("1", obj.mjr.toString(), name);
        assert.strictEqual("23", obj.another.toString(), name);
        assert.strictEqual("1234", obj.home.toString(), name);
        next(name);
    });
};

tests.HGETALL_2 = function () {
    var name = "HGETALL (Binary client)";
    bclient.hmset(["bhosts", "mjr", "1", "another", "23", "home", "1234", new Buffer([0xAA, 0xBB, 0x00, 0xF0]), new Buffer([0xCC, 0xDD, 0x00, 0xF0])], require_string("OK", name));
    bclient.HGETALL(["bhosts"], function (err, obj) {
        assert.strictEqual(null, err, name + " result sent back unexpected error: " + err);
        assert.strictEqual(4, Object.keys(obj).length, name);
        assert.strictEqual("1", obj.mjr.toString(), name);
        assert.strictEqual("23", obj.another.toString(), name);
        assert.strictEqual("1234", obj.home.toString(), name);
        assert.strictEqual((new Buffer([0xAA, 0xBB, 0x00, 0xF0])).toString('binary'), Object.keys(obj)[3], name);
        assert.strictEqual((new Buffer([0xCC, 0xDD, 0x00, 0xF0])).toString('binary'), obj[(new Buffer([0xAA, 0xBB, 0x00, 0xF0])).toString('binary')].toString('binary'), name);
        next(name);
    });
};

tests.HGETALL_MESSAGE = function () {
    var name = "HGETALL_MESSAGE";
    client.hmset("msg_test", {message: "hello"}, require_string("OK", name));
    client.hgetall("msg_test", function (err, obj) {
        assert.strictEqual(null, err, name + " result sent back unexpected error: " + err);
        assert.strictEqual(1, Object.keys(obj).length, name);
        assert.strictEqual(obj.message, "hello");
        next(name);
    });
};

tests.HGETALL_NULL = function () {
    var name = "HGETALL_NULL";

    client.hgetall("missing", function (err, obj) {
        assert.strictEqual(null, err);
        assert.strictEqual(null, obj);
        next(name);
    });
};

tests.UTF8 = function () {
    var name = "UTF8",
        utf8_sample = "ಠ_ಠ";

    client.set(["utf8test", utf8_sample], require_string("OK", name));
    client.get(["utf8test"], function (err, obj) {
        assert.strictEqual(null, err);
        assert.strictEqual(utf8_sample, obj);
        next(name);
    });
};

// Set tests were adapted from Brian Hammond's redis-node-client.js, which has a comprehensive test suite

tests.SADD = function () {
    var name = "SADD";

    client.del('set0');
    client.SADD('set0', 'member0', require_number(1, name));
    client.sadd('set0', 'member0', last(name, require_number(0, name)));
};

tests.SADD2 = function () {
    var name = "SADD2";

    client.del("set0");
    client.sadd("set0", ["member0", "member1", "member2"], require_number(3, name));
    client.smembers("set0", function (err, res) {
        assert.strictEqual(res.length, 3);
        assert.ok(~res.indexOf("member0"));
        assert.ok(~res.indexOf("member1"));
        assert.ok(~res.indexOf("member2"));
    });
    client.SADD("set1", ["member0", "member1", "member2"], require_number(3, name));
    client.smembers("set1", function (err, res) {
        assert.strictEqual(res.length, 3);
        assert.ok(~res.indexOf("member0"));
        assert.ok(~res.indexOf("member1"));
        assert.ok(~res.indexOf("member2"));
        next(name);
    });
};

tests.SISMEMBER = function () {
    var name = "SISMEMBER";

    client.del('set0');
    client.sadd('set0', 'member0', require_number(1, name));
    client.sismember('set0', 'member0', require_number(1, name));
    client.sismember('set0', 'member1', last(name, require_number(0, name)));
};

tests.SCARD = function () {
    var name = "SCARD";

    client.del('set0');
    client.sadd('set0', 'member0', require_number(1, name));
    client.scard('set0', require_number(1, name));
    client.sadd('set0', 'member1', require_number(1, name));
    client.scard('set0', last(name, require_number(2, name)));
};

tests.SREM = function () {
    var name = "SREM";

    client.del('set0');
    client.sadd('set0', 'member0', require_number(1, name));
    client.srem('set0', 'foobar', require_number(0, name));
    client.srem('set0', 'member0', require_number(1, name));
    client.scard('set0', last(name, require_number(0, name)));
};


tests.SREM2 = function () {
    var name = "SREM2";
    client.del("set0");
    client.sadd("set0", ["member0", "member1", "member2"], require_number(3, name));
    client.SREM("set0", ["member1", "member2"], require_number(2, name));
    client.smembers("set0", function (err, res) {
        assert.strictEqual(res.length, 1);
        assert.ok(~res.indexOf("member0"));
    });
    client.sadd("set0", ["member3", "member4", "member5"], require_number(3, name));
    client.srem("set0", ["member0", "member6"], require_number(1, name));
    client.smembers("set0", function (err, res) {
        assert.strictEqual(res.length, 3);
        assert.ok(~res.indexOf("member3"));
        assert.ok(~res.indexOf("member4"));
        assert.ok(~res.indexOf("member5"));
        next(name);
    });
};

tests.SPOP = function () {
    var name = "SPOP";

    client.del('zzz');
    client.sadd('zzz', 'member0', require_number(1, name));
    client.scard('zzz', require_number(1, name));

    client.spop('zzz', function (err, value) {
        if (err) {
            assert.fail(err);
        }
        assert.equal(value, 'member0', name);
    });

    client.scard('zzz', last(name, require_number(0, name)));
};

tests.SDIFF = function () {
    var name = "SDIFF";

    client.del('foo');
    client.sadd('foo', 'x', require_number(1, name));
    client.sadd('foo', 'a', require_number(1, name));
    client.sadd('foo', 'b', require_number(1, name));
    client.sadd('foo', 'c', require_number(1, name));

    client.sadd('bar', 'c', require_number(1, name));

    client.sadd('baz', 'a', require_number(1, name));
    client.sadd('baz', 'd', require_number(1, name));

    client.sdiff('foo', 'bar', 'baz', function (err, values) {
        if (err) {
            assert.fail(err, name);
        }
        values.sort();
        assert.equal(values.length, 2, name);
        assert.equal(values[0], 'b', name);
        assert.equal(values[1], 'x', name);
        next(name);
    });
};

tests.SDIFFSTORE = function () {
    var name = "SDIFFSTORE";

    client.del('foo');
    client.del('bar');
    client.del('baz');
    client.del('quux');

    client.sadd('foo', 'x', require_number(1, name));
    client.sadd('foo', 'a', require_number(1, name));
    client.sadd('foo', 'b', require_number(1, name));
    client.sadd('foo', 'c', require_number(1, name));

    client.sadd('bar', 'c', require_number(1, name));

    client.sadd('baz', 'a', require_number(1, name));
    client.sadd('baz', 'd', require_number(1, name));

    // NB: SDIFFSTORE returns the number of elements in the dstkey

    client.sdiffstore('quux', 'foo', 'bar', 'baz', require_number(2, name));

    client.smembers('quux', function (err, values) {
        if (err) {
            assert.fail(err, name);
        }
        var members = buffers_to_strings(values).sort();

        assert.deepEqual(members, [ 'b', 'x' ], name);
        next(name);
    });
};

tests.SMEMBERS = function () {
    var name = "SMEMBERS";

    client.del('foo');
    client.sadd('foo', 'x', require_number(1, name));

    client.smembers('foo', function (err, members) {
        if (err) {
            assert.fail(err, name);
        }
        assert.deepEqual(buffers_to_strings(members), [ 'x' ], name);
    });

    client.sadd('foo', 'y', require_number(1, name));

    client.smembers('foo', function (err, values) {
        if (err) {
            assert.fail(err, name);
        }
        assert.equal(values.length, 2, name);
        var members = buffers_to_strings(values).sort();

        assert.deepEqual(members, [ 'x', 'y' ], name);
        next(name);
    });
};

tests.SMOVE = function () {
    var name = "SMOVE";

    client.del('foo');
    client.del('bar');

    client.sadd('foo', 'x', require_number(1, name));
    client.smove('foo', 'bar', 'x', require_number(1, name));
    client.sismember('foo', 'x', require_number(0, name));
    client.sismember('bar', 'x', require_number(1, name));
    client.smove('foo', 'bar', 'x', last(name, require_number(0, name)));
};

tests.SINTERSTORE = function () {
    var name = "SINTERSTORE";

    client.del('sa');
    client.del('sb');
    client.del('sc');
    client.del('foo');

    client.sadd('sa', 'a', require_number(1, name));
    client.sadd('sa', 'b', require_number(1, name));
    client.sadd('sa', 'c', require_number(1, name));

    client.sadd('sb', 'b', require_number(1, name));
    client.sadd('sb', 'c', require_number(1, name));
    client.sadd('sb', 'd', require_number(1, name));

    client.sadd('sc', 'c', require_number(1, name));
    client.sadd('sc', 'd', require_number(1, name));
    client.sadd('sc', 'e', require_number(1, name));

    client.sinterstore('foo', 'sa', 'sb', 'sc', require_number(1, name));

    client.smembers('foo', function (err, members) {
        if (err) {
            assert.fail(err, name);
        }
        assert.deepEqual(buffers_to_strings(members), [ 'c' ], name);
        next(name);
    });
};

tests.SUNION = function () {
    var name = "SUNION";

    client.del('sa');
    client.del('sb');
    client.del('sc');

    client.sadd('sa', 'a', require_number(1, name));
    client.sadd('sa', 'b', require_number(1, name));
    client.sadd('sa', 'c', require_number(1, name));

    client.sadd('sb', 'b', require_number(1, name));
    client.sadd('sb', 'c', require_number(1, name));
    client.sadd('sb', 'd', require_number(1, name));

    client.sadd('sc', 'c', require_number(1, name));
    client.sadd('sc', 'd', require_number(1, name));
    client.sadd('sc', 'e', require_number(1, name));

    client.sunion('sa', 'sb', 'sc', function (err, union) {
        if (err) {
            assert.fail(err, name);
        }
        assert.deepEqual(buffers_to_strings(union).sort(), ['a', 'b', 'c', 'd', 'e'], name);
        next(name);
    });
};

tests.SUNIONSTORE = function () {
    var name = "SUNIONSTORE";

    client.del('sa');
    client.del('sb');
    client.del('sc');
    client.del('foo');

    client.sadd('sa', 'a', require_number(1, name));
    client.sadd('sa', 'b', require_number(1, name));
    client.sadd('sa', 'c', require_number(1, name));

    client.sadd('sb', 'b', require_number(1, name));
    client.sadd('sb', 'c', require_number(1, name));
    client.sadd('sb', 'd', require_number(1, name));

    client.sadd('sc', 'c', require_number(1, name));
    client.sadd('sc', 'd', require_number(1, name));
    client.sadd('sc', 'e', require_number(1, name));

    client.sunionstore('foo', 'sa', 'sb', 'sc', function (err, cardinality) {
        if (err) {
            assert.fail(err, name);
        }
        assert.equal(cardinality, 5, name);
    });

    client.smembers('foo', function (err, members) {
        if (err) {
            assert.fail(err, name);
        }
        assert.equal(members.length, 5, name);
        assert.deepEqual(buffers_to_strings(members).sort(), ['a', 'b', 'c', 'd', 'e'], name);
        next(name);
    });
};

tests.MONITOR = function () {
    var name = "MONITOR", responses = [], monitor_client;

    if (!server_version_at_least(client, [2, 6, 0])) {
        console.log("Skipping " + name + " for old Redis server version < 2.6.x");
        return next(name);
    }

    monitor_client = redis.createClient(PORT, HOST, { parser: parser });
    monitor_client.monitor(function (err, res) {
        client.mget("some", "keys", "foo", "bar");
        client.set("json", JSON.stringify({
            foo: "123",
            bar: "sdflkdfsjk",
            another: false
        }));
    });
    monitor_client.on("monitor", function (time, args) {
        // skip monitor command for Redis <= 2.4.16
        if (args[0] === "monitor") return;

        responses.push(args);
        if (responses.length === 2) {
            assert.strictEqual(5, responses[0].length);
            assert.strictEqual("mget", responses[0][0]);
            assert.strictEqual("some", responses[0][1]);
            assert.strictEqual("keys", responses[0][2]);
            assert.strictEqual("foo", responses[0][3]);
            assert.strictEqual("bar", responses[0][4]);
            assert.strictEqual(3, responses[1].length);
            assert.strictEqual("set", responses[1][0]);
            assert.strictEqual("json", responses[1][1]);
            assert.strictEqual('{"foo":"123","bar":"sdflkdfsjk","another":false}', responses[1][2]);
            monitor_client.quit(function (err, res) {
                next(name);
            });
        }
    });
};

tests.BLPOP = function () {
    var name = "BLPOP";

    client.rpush("blocking list", "initial value", function (err, res) {
        client2.BLPOP("blocking list", 0, function (err, res) {
            assert.strictEqual("blocking list", res[0].toString());
            assert.strictEqual("initial value", res[1].toString());

            client.rpush("blocking list", "wait for this value");
        });
        client2.BLPOP("blocking list", 0, function (err, res) {
            assert.strictEqual("blocking list", res[0].toString());
            assert.strictEqual("wait for this value", res[1].toString());
            next(name);
        });
    });
};

tests.BLPOP_TIMEOUT = function () {
    var name = "BLPOP_TIMEOUT";

    // try to BLPOP the list again, which should be empty.  This should timeout and return null.
    client2.BLPOP("blocking list", 1, function (err, res) {
        if (err) {
            throw err;
        }

        assert.strictEqual(res, null);
        next(name);
    });
};

tests.EXPIRE = function () {
    var name = "EXPIRE";
    client.set(['expiry key', 'bar'], require_string("OK", name));
    client.EXPIRE(["expiry key", "1"], require_number_pos(name));
    setTimeout(function () {
        client.exists(["expiry key"], last(name, require_number(0, name)));
    }, 2000);
};

tests.TTL = function () {
    var name = "TTL";
    client.set(["ttl key", "ttl val"], require_string("OK", name));
    client.expire(["ttl key", "100"], require_number_pos(name));
    setTimeout(function () {
        client.TTL(["ttl key"], last(name, require_number_pos(0, name)));
    }, 500);
};

tests.OPTIONAL_CALLBACK = function () {
    var name = "OPTIONAL_CALLBACK";
    client.del("op_cb1");
    client.set("op_cb1", "x");
    client.get("op_cb1", last(name, require_string("x", name)));
};

tests.OPTIONAL_CALLBACK_UNDEFINED = function () {
    var name = "OPTIONAL_CALLBACK_UNDEFINED";
    client.del("op_cb2");
    client.set("op_cb2", "y", undefined);
    client.get("op_cb2", last(name, require_string("y", name)));

    client.set("op_cb_undefined", undefined, undefined);
};

tests.ENABLE_OFFLINE_QUEUE_TRUE = function () {
    var name = "ENABLE_OFFLINE_QUEUE_TRUE";
    var cli = redis.createClient(9999, null, {
        max_attempts: 1,
        parser: parser
        // default :)
        // enable_offline_queue: true
    });
    cli.on('error', function(e) {
        // ignore, b/c expecting a "can't connect" error
    });
    return setTimeout(function() {
        cli.set(name, name, function(err, result) {
            assert.ifError(err);
        });

        return setTimeout(function(){
            assert.strictEqual(cli.offline_queue.length, 1);
            return next(name);
        }, 25);
    }, 50);
};

tests.ENABLE_OFFLINE_QUEUE_FALSE = function () {
    var name = "ENABLE_OFFLINE_QUEUE_FALSE";
    var cli = redis.createClient(9999, null, {
        parser: parser,
        max_attempts: 1,
        enable_offline_queue: false
    });
    cli.on('error', function() {
        // ignore, see above
    });
    assert.throws(function () {
        cli.set(name, name);
    });
    assert.doesNotThrow(function () {
        cli.set(name, name, function (err) {
            // should callback with an error
            assert.ok(err);
            setTimeout(function () {
                next(name);
            }, 50);
        });
    });
};

tests.SLOWLOG = function () {
    var name = "SLOWLOG";
    client.config("set", "slowlog-log-slower-than", 0, require_string("OK", name));
    client.slowlog("reset", require_string("OK", name));
    client.set("foo", "bar", require_string("OK", name));
    client.get("foo", require_string("bar", name));
    client.slowlog("get", function (err, res) {
        assert.equal(res.length, 3, name);
        assert.equal(res[0][3].length, 2, name);
        assert.deepEqual(res[1][3], ["set", "foo", "bar"], name);
        assert.deepEqual(res[2][3], ["slowlog", "reset"], name);
        client.config("set", "slowlog-log-slower-than", 10000, require_string("OK", name));
        next(name);
    });
};

tests.DOMAIN = function () {
    var name = "DOMAIN";

    var domain;
    try {
        domain = require('domain').create();
    } catch (err) {
        console.log("Skipping " + name + " because this version of node doesn't have domains.");
        next(name);
    }

    if (domain) {
        domain.run(function () {
            client.set('domain', 'value', function (err, res) {
                assert.ok(process.domain);
                var notFound = res.not.existing.thing; // ohhh nooooo
            });
        });

        // this is the expected and desired behavior
        domain.on('error', function (err) {
          domain.exit();
          next(name);
        });
    }
};

tests.reconnectRetryMaxDelay = function() {
    var time = new Date().getTime(),
        name = 'reconnectRetryMaxDelay',
        reconnecting = false;
    var client = redis.createClient(PORT, HOST, {
        retry_max_delay: 1,
        parser: parser
    });
    client.on('ready', function() {
        if (!reconnecting) {
            reconnecting = true;
            client.retry_delay = 1000;
            client.retry_backoff = 1;
            client.stream.end();
        } else {
            client.end();
            var lasted = new Date().getTime() - time;
            assert.ok(lasted < 1000);
            next(name);
        }
    });
};

// starting to split tests into multiple files.
require('./queue-test')(tests, next);

all_tests = Object.keys(tests);
all_start = new Date();
test_count = 0;

run_next_test = function run_next_test() {
    var test_name = all_tests.shift();
    if (typeof tests[test_name] === "function") {
        console.log('- \x1b[1m' + test_name.toLowerCase() + '\x1b[0m:');
        cur_start = new Date();
        test_count += 1;
        tests[test_name]();
    } else {
        console.log('\n  completed \x1b[32m%d\x1b[0m tests in \x1b[33m%d\x1b[0m ms\n', test_count, new Date() - all_start);
        client.quit();
        client2.quit();
        bclient.quit();
    }
};

client.once("ready", function start_tests() {
    console.log("Connected to " + client.address + ", Redis server version " + client.server_info.redis_version + "\n");
    console.log("Using reply parser " + client.reply_parser.name);

    run_next_test();

    connected = true;
});

client.on('end', function () {
    ended = true;
});

// Exit immediately on connection failure, which triggers "exit", below, which fails the test
client.on("error", function (err) {
    console.error("client: " + err.stack);
    process.exit();
});
client2.on("error", function (err) {
    console.error("client2: " + err.stack);
    process.exit();
});
client3.on("error", function (err) {
    console.error("client3: " + err.stack);
    process.exit();
});
bclient.on("error", function (err) {
    console.error("bclient: " + err.stack);
    process.exit();
});

client.on("reconnecting", function (params) {
    console.log("reconnecting: " + util.inspect(params));
});

process.on('uncaughtException', function (err) {
    console.error("Uncaught exception: " + err.stack);
    process.exit(1);
});

process.on('exit', function (code) {
    assert.equal(true, connected);
    assert.equal(true, ended);
});
