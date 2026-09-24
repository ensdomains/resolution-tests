const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const eth_dep = b.dependency("eth_zig", .{
        .target = target,
        .optimize = optimize,
    });
    const eth_module = eth_dep.module("eth");

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/resolution_test.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "eth", .module = eth_module },
            },
        }),
    });

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run ENS resolution tests");
    test_step.dependOn(&run_tests.step);
}
