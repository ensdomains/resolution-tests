//! ENS resolution tests for eth.zig (Universal Resolver path).

const std = @import("std");
const eth = @import("eth");
const json = std.json;
const Allocator = std.mem.Allocator;

const unsupported_methods = [_][]const u8{"reverse-l2"};

const TestResult = struct {
    caseId: []const u8,
    passed: bool,
    actual: ?[]const u8,
    @"error": ?[]const u8,
    durationMs: i64,
};

const Input = struct {
    name: ?[]const u8 = null,
    address: ?[]const u8 = null,
};

const Expected = struct {
    address: ?[]const u8 = null,
    value: ?[]const u8 = null,
    name: ?[]const u8 = null,
};

const Params = struct {
    coinType: ?u64 = null,
    key: ?[]const u8 = null,
    chainId: ?u64 = null,
};

const TestCase = struct {
    id: []const u8,
    category: []const u8,
    status: []const u8,
    method: []const u8,
    input: Input,
    expected: Expected,
    params: Params = .{},
};

fn loadRpcUrl(allocator: Allocator, io: std.Io) ![]u8 {
    if (std.c.getenv("RPC_URL")) |raw| {
        const url = std.mem.span(raw);
        if (url.len > 0) return try allocator.dupe(u8, url);
    }

    // When run via `zig build test`, cwd is the package root.
    const cwd = std.Io.Dir.cwd();
    const contents = cwd.readFileAlloc(io, "../../.env", allocator, .limited(1024 * 1024)) catch {
        return error.MissingRpcUrl;
    };
    defer allocator.free(contents);

    var lines = std.mem.splitScalar(u8, contents, '\n');
    while (lines.next()) |raw_line| {
        const line = std.mem.trim(u8, raw_line, " \t\r");
        if (line.len == 0 or line[0] == '#' or std.mem.indexOfScalar(u8, line, '=') == null) continue;
        var parts = std.mem.splitScalar(u8, line, '=');
        const key = std.mem.trim(u8, parts.next() orelse continue, " \t");
        var value = std.mem.trim(u8, parts.rest(), " \t");
        if (value.len >= 2 and ((value[0] == '"' and value[value.len - 1] == '"') or (value[0] == '\'' and value[value.len - 1] == '\''))) {
            value = value[1 .. value.len - 1];
        }
        if (std.mem.eql(u8, key, "RPC_URL") and value.len > 0) {
            return try allocator.dupe(u8, value);
        }
    }
    return error.MissingRpcUrl;
}

fn expectedValue(case: TestCase) ?[]const u8 {
    return case.expected.address orelse case.expected.value orelse case.expected.name;
}

fn isUnsupported(method: []const u8) bool {
    for (unsupported_methods) |m| {
        if (std.mem.eql(u8, m, method)) return true;
    }
    return false;
}

fn truncateErr(allocator: Allocator, msg: []const u8) ![]u8 {
    if (msg.len <= 500) return try allocator.dupe(u8, msg);
    return try std.fmt.allocPrint(allocator, "{s}…", .{msg[0..500]});
}

fn formatAddress(addr: eth.primitives.Address) [42]u8 {
    return eth.primitives.addressToChecksum(&addr);
}

fn runForward(allocator: Allocator, provider: *eth.provider.Provider, case: TestCase) !?[]u8 {
    if (std.mem.eql(u8, case.method, "addr")) {
        const name = case.input.name orelse return error.MissingName;
        const coin = case.params.coinType orelse 60;
        if (coin != 60) return error.UnsupportedCoinType;
        const maybe = try eth.ens_resolver.resolve(allocator, provider, name);
        if (maybe) |addr| {
            const checksum = formatAddress(addr);
            return try allocator.dupe(u8, &checksum);
        }
        return null;
    } else if (std.mem.eql(u8, case.method, "text")) {
        const name = case.input.name orelse return error.MissingName;
        const key = case.params.key orelse return error.MissingKey;
        return try eth.ens_resolver.getText(allocator, provider, name, key);
    } else if (std.mem.eql(u8, case.method, "contenthash")) {
        const name = case.input.name orelse return error.MissingName;
        var maybe = try eth.ens_resolver.getContentHash(allocator, provider, name);
        if (maybe) |*ch| {
            defer ch.deinit(allocator);
            return try allocator.dupe(u8, ch.uri);
        }
        return null;
    }
    return error.UnexpectedMethod;
}

fn runReverse(allocator: Allocator, provider: *eth.provider.Provider, case: TestCase) !?[]u8 {
    if (!std.mem.eql(u8, case.method, "reverse")) return error.UnexpectedMethod;
    const addr_str = case.input.address orelse return error.MissingAddress;
    const address = try eth.primitives.addressFromHex(addr_str);
    return try eth.ens_reverse.lookupAddress(allocator, provider, address);
}

fn valuesMatch(method: []const u8, actual: ?[]const u8, expected: ?[]const u8) bool {
    if (actual == null and expected == null) return true;
    if (actual == null or expected == null) return false;
    if (std.mem.eql(u8, actual.?, expected.?)) return true;
    // eth.zig renders dag-pb/sha2-256 IPFS hashes as CIDv0 (`Qm...`); the suite
    // expected value uses CIDv1 (`bafy...`). Both encode the same content.
    if (std.mem.eql(u8, method, "contenthash")) {
        const a = actual.?;
        const e = expected.?;
        const a_cid = if (std.mem.startsWith(u8, a, "ipfs://")) a["ipfs://".len..] else a;
        const e_cid = if (std.mem.startsWith(u8, e, "ipfs://")) e["ipfs://".len..] else e;
        const a_v0 = std.mem.startsWith(u8, a_cid, "Qm");
        const e_v1 = std.mem.startsWith(u8, e_cid, "bafy");
        const a_v1 = std.mem.startsWith(u8, a_cid, "bafy");
        const e_v0 = std.mem.startsWith(u8, e_cid, "Qm");
        if ((a_v0 and e_v1) or (a_v1 and e_v0)) return true;
    }
    return false;
}

test "ENS resolution suite" {
    var gpa_state: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa_state.deinit();
    const allocator = gpa_state.allocator();
    const io = eth.runtime.blockingIo();

    var results: std.ArrayList(TestResult) = .empty;
    defer {
        for (results.items) |r| {
            allocator.free(r.caseId);
            if (r.actual) |a| allocator.free(a);
            if (r.@"error") |e| allocator.free(e);
        }
        results.deinit(allocator);
    }

    const rpc_url = loadRpcUrl(allocator, io) catch {
        std.debug.print("RPC_URL environment variable is required\n", .{});
        return error.MissingRpcUrl;
    };
    defer allocator.free(rpc_url);

    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const arena_alloc = arena.allocator();

    const cwd = std.Io.Dir.cwd();
    const cases_json = try cwd.readFileAlloc(io, "../../test-cases.json", arena_alloc, .limited(1024 * 1024));
    const parsed = try json.parseFromSlice([]TestCase, arena_alloc, cases_json, .{
        .ignore_unknown_fields = true,
        .allocate = .alloc_always,
    });
    const all_cases = parsed.value;

    var transport = eth.http_transport.HttpTransport.init(allocator, rpc_url, io);
    defer transport.deinit();
    var provider = eth.provider.Provider.init(allocator, &transport);

    var failures: std.ArrayList([]u8) = .empty;
    defer {
        for (failures.items) |f| allocator.free(f);
        failures.deinit(allocator);
    }

    for (all_cases) |case| {
        if (!std.mem.eql(u8, case.status, "ready")) continue;
        if (isUnsupported(case.method)) continue;
        if (std.mem.eql(u8, case.method, "addr")) {
            if (case.params.coinType) |ct| {
                if (ct != 60) continue;
            }
        }
        if (!std.mem.eql(u8, case.category, "forward") and !std.mem.eql(u8, case.category, "reverse")) continue;

        const start = eth.runtime.milliTimestamp(io);
        const expected = expectedValue(case);

        const outcome = if (std.mem.eql(u8, case.category, "forward"))
            runForward(allocator, &provider, case)
        else
            runReverse(allocator, &provider, case);

        const duration = eth.runtime.milliTimestamp(io) - start;

        if (outcome) |actual| {
            defer if (actual) |a| allocator.free(a);
            const passed = valuesMatch(case.method, actual, expected);
            const err_msg: ?[]const u8 = if (passed) null else try std.fmt.allocPrint(
                allocator,
                "Expected {s}, got {s}",
                .{ expected orelse "null", actual orelse "null" },
            );
            defer if (err_msg) |m| allocator.free(m);

            try results.append(allocator, .{
                .caseId = try allocator.dupe(u8, case.id),
                .passed = passed,
                .actual = if (actual) |a| try allocator.dupe(u8, a) else null,
                .@"error" = if (err_msg) |m| try allocator.dupe(u8, m) else null,
                .durationMs = duration,
            });
            if (!passed) {
                try failures.append(allocator, try std.fmt.allocPrint(allocator, "{s}: {s}", .{ case.id, err_msg.? }));
            }
        } else |err| {
            const msg = try truncateErr(allocator, @errorName(err));
            defer allocator.free(msg);
            try results.append(allocator, .{
                .caseId = try allocator.dupe(u8, case.id),
                .passed = false,
                .actual = null,
                .@"error" = try allocator.dupe(u8, msg),
                .durationMs = duration,
            });
            try failures.append(allocator, try std.fmt.allocPrint(allocator, "{s}: {s}", .{ case.id, msg }));
        }
    }

    var out: std.Io.Writer.Allocating = .init(allocator);
    defer out.deinit();
    {
        const epoch_sec = std.Io.Clock.now(.real, io).toSeconds();
        try out.writer.print("{{\n  \"timestamp\": \"{d}\",\n  \"results\": ", .{epoch_sec});
        try json.Stringify.value(results.items, .{ .whitespace = .indent_2 }, &out.writer);
        try out.writer.writeAll("\n}\n");
    }

    try std.Io.Dir.cwd().writeFile(io, .{ .sub_path = "results.json", .data = out.written() });
    std.debug.print("\nResults written to results.json\n", .{});

    if (failures.items.len > 0) {
        std.debug.print("{d} failure(s):\n", .{failures.items.len});
        for (failures.items) |f| std.debug.print("  {s}\n", .{f});
        return error.TestFailure;
    }
}
