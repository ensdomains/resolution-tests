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

fn loadRpcUrl(allocator: Allocator) ![]u8 {
    if (std.c.getenv("RPC_URL")) |raw| {
        const url = std.mem.span(raw);
        if (url.len > 0) return try allocator.dupe(u8, url);
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

fn decodeCidV0(cid: []const u8) ?[34]u8 {
    if (cid.len != 46 or !std.mem.startsWith(u8, cid, "Qm")) return null;
    var bytes: [34]u8 = @splat(0);
    for (cid) |char| {
        const digit = std.mem.indexOfScalar(u8, "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", char) orelse return null;
        var carry: usize = digit;
        var i: usize = bytes.len;
        while (i > 0) {
            i -= 1;
            carry += @as(usize, bytes[i]) * 58;
            bytes[i] = @intCast(carry & 0xff);
            carry >>= 8;
        }
        if (carry != 0) return null;
    }
    if (bytes[0] != 0x12 or bytes[1] != 0x20) return null;
    return bytes;
}

fn decodeCidV1(cid: []const u8) ?[36]u8 {
    if (cid.len != 59 or cid[0] != 'b') return null;
    var bytes: [36]u8 = @splat(0);
    var output_index: usize = 0;
    var pending: u16 = 0;
    var bit_count: u8 = 0;
    for (cid[1..]) |char| {
        const digit = std.mem.indexOfScalar(u8, "abcdefghijklmnopqrstuvwxyz234567", char) orelse return null;
        pending = (pending << 5) | @as(u16, @intCast(digit));
        bit_count += 5;
        if (bit_count >= 8) {
            bit_count -= 8;
            if (output_index >= bytes.len) return null;
            bytes[output_index] = @intCast((pending >> @intCast(bit_count)) & 0xff);
            output_index += 1;
            pending &= (@as(u16, 1) << @intCast(bit_count)) - 1;
        }
    }
    if (output_index != bytes.len or bit_count != 2 or pending != 0) return null;
    if (bytes[0] != 1 or bytes[1] != 0x70 or bytes[2] != 0x12 or bytes[3] != 0x20) return null;
    return bytes;
}

fn equivalentIpfsCid(a: []const u8, b: []const u8) bool {
    const a_cid = if (std.mem.startsWith(u8, a, "ipfs://")) a["ipfs://".len..] else a;
    const b_cid = if (std.mem.startsWith(u8, b, "ipfs://")) b["ipfs://".len..] else b;
    if (decodeCidV0(a_cid)) |v0| {
        if (decodeCidV1(b_cid)) |v1| return std.mem.eql(u8, &v0, v1[2..]);
    }
    if (decodeCidV1(a_cid)) |v1| {
        if (decodeCidV0(b_cid)) |v0| return std.mem.eql(u8, v1[2..], &v0);
    }
    return false;
}

test "CIDv0 and CIDv1 contenthashes match only for the same multihash" {
    const v0 = "ipfs://Qmaisz6NMhDB51cCvNWa1GMS7LU1pAxdF4Ld6Ft9kZEP2a";
    const v1 = "ipfs://bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m";
    try std.testing.expect(equivalentIpfsCid(v0, v1));
    try std.testing.expect(!equivalentIpfsCid(v0, "ipfs://bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk2m"));
}

fn valuesMatch(method: []const u8, actual: ?[]const u8, expected: ?[]const u8) bool {
    if (actual == null and expected == null) return true;
    if (actual == null or expected == null) return false;
    if (std.mem.eql(u8, actual.?, expected.?)) return true;
    return std.mem.eql(u8, method, "contenthash") and equivalentIpfsCid(actual.?, expected.?);
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

    const rpc_url = loadRpcUrl(allocator) catch {
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
