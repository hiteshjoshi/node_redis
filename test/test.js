return;

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
