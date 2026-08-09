using System.Diagnostics;
using System.Numerics;
using System.Text.Json;
using System.Text.Json.Serialization;
using NetCid;
using Nethereum.Contracts.Standards.ENS;
using Nethereum.Contracts.Standards.ENS.PublicResolver.ContractDefinition;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Util;

namespace Nethereum.Ens.Tests;

public class ResolutionTests : IAsyncLifetime
{
    // Registry-based ENSService has no L2 primary-name API.
    private static readonly HashSet<string> UnsupportedMethods = new() { "reverse-l2" };

    private static readonly object ResultsLock = new();
    private static readonly List<TestResult> Results = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public async Task InitializeAsync() => await Task.CompletedTask;

    public async Task DisposeAsync()
    {
        WriteResults();
        await Task.CompletedTask;
    }

    [Fact]
    public async Task ForwardResolution()
    {
        var ens = CreateEnsService();
        var failures = new List<string>();

        foreach (var testCase in LoadReadyCases("forward"))
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var actual = await RunForwardAsync(ens, testCase);
                sw.Stop();
                var expected = ExpectedValue(testCase);
                var passed = ValuesMatch(testCase.Method, actual, expected);
                string? error = passed
                    ? null
                    : $"Expected {PtrOrNull(expected)}, got {PtrOrNull(actual)}";
                RecordResult(testCase.Id, passed, actual, error, sw.ElapsedMilliseconds);
                if (!passed)
                {
                    failures.Add($"{testCase.Id}: {error}");
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                var msg = TruncateErr(ex);
                RecordResult(testCase.Id, false, null, msg, sw.ElapsedMilliseconds);
                failures.Add($"{testCase.Id}: {msg}");
            }
        }

        Assert.True(failures.Count == 0, $"{failures.Count} failure(s):\n{string.Join("\n", failures)}");
    }

    [Fact]
    public async Task ReverseResolution()
    {
        var ens = CreateEnsService();
        var failures = new List<string>();

        foreach (var testCase in LoadReadyCases("reverse"))
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var actual = await RunReverseAsync(ens, testCase);
                sw.Stop();
                var expected = ExpectedValue(testCase);
                var passed = string.Equals(actual, expected, StringComparison.Ordinal);
                string? error = passed
                    ? null
                    : $"Expected {PtrOrNull(expected)}, got {PtrOrNull(actual)}";
                RecordResult(testCase.Id, passed, actual, error, sw.ElapsedMilliseconds);
                if (!passed)
                {
                    failures.Add($"{testCase.Id}: {error}");
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                var msg = TruncateErr(ex);
                RecordResult(testCase.Id, false, null, msg, sw.ElapsedMilliseconds);
                failures.Add($"{testCase.Id}: {msg}");
            }
        }

        Assert.True(failures.Count == 0, $"{failures.Count} failure(s):\n{string.Join("\n", failures)}");
    }

    private static ENSService CreateEnsService()
    {
        var web3 = new Nethereum.Web3.Web3(LoadRpcUrl());
        return web3.Eth.GetEnsService();
    }

    private static async Task<string?> RunForwardAsync(ENSService ens, TestCase testCase)
    {
        switch (testCase.Method)
        {
            case "addr":
            {
                var name = testCase.Input.Name ?? throw new Exception("missing name");
                var coinType = ParamUInt64(testCase.Params, "coinType")
                    ?? throw new Exception("missing coinType");

                if (coinType == 60)
                {
                    var address = await ens.ResolveAddressAsync(name);
                    return FormatAddress(address);
                }

                var node = new EnsUtil().GetNameHash(name).HexToByteArray();
                var fn = new AddrFunction2
                {
                    Node = node,
                    CoinType = new BigInteger(coinType),
                };
                var result = await ens.ResolveAsync<AddrFunction2, AddrOutputDTO2>(fn, name);
                var raw = result.ReturnValue1;
                if (raw == null || raw.Length == 0)
                {
                    return null;
                }

                return FormatAddress(raw.ToHex(true));
            }
            case "text":
            {
                var name = testCase.Input.Name ?? throw new Exception("missing name");
                var key = ParamString(testCase.Params, "key")
                    ?? throw new Exception("missing text key");
                if (!Enum.TryParse<TextDataKey>(key, ignoreCase: true, out var textKey))
                {
                    throw new Exception($"unsupported text key: {key}");
                }

                var value = await ens.ResolveTextAsync(name, textKey);
                return string.IsNullOrEmpty(value) ? null : value;
            }
            case "contenthash":
            {
                var name = testCase.Input.Name ?? throw new Exception("missing name");
                var raw = await ens.GetContentHashAsync(name);
                if (raw == null || raw.Length == 0)
                {
                    return null;
                }

                return ContentHashToUri(raw);
            }
            default:
                throw new Exception($"unexpected method: {testCase.Method}");
        }
    }

    private static async Task<string?> RunReverseAsync(ENSService ens, TestCase testCase)
    {
        if (testCase.Method != "reverse")
        {
            throw new Exception($"unexpected method: {testCase.Method}");
        }

        var address = testCase.Input.Address ?? throw new Exception("missing address");
        var name = await ens.ReverseResolveAsync(address);
        return string.IsNullOrEmpty(name) ? null : name;
    }

    private static string ContentHashToUri(byte[] contentHash)
    {
        if (!Multicodec.TryDecode(contentHash, out var codec, out var data) || data is null)
        {
            throw new Exception("invalid contenthash multicodec");
        }

        // ipfs-ns
        if (codec != 0xe3)
        {
            throw new Exception($"unsupported contenthash codec: 0x{codec:x}");
        }

        // After the EIP-1577 namespace, remaining bytes are either a CIDv1 or a
        // bare CIDv0 multihash (sha2-256).
        Cid cid;
        if (MultihashDigest.TryParse(data, out var digest, out var consumed)
            && consumed == data.Length
            && digest.Code == MultihashCode.Sha2_256
            && digest.DigestLength == 32)
        {
            cid = Cid.CreateV0(digest);
        }
        else
        {
            cid = Cid.Decode(data);
        }

        return "ipfs://" + cid.ToV1().ToString();
    }

    private static bool ValuesMatch(string method, string? actual, string? expected)
    {
        if (string.Equals(actual, expected, StringComparison.Ordinal))
        {
            return true;
        }

        if (method != "contenthash" || actual == null || expected == null)
        {
            return false;
        }

        try
        {
            return NormalizeContenthash(actual) == NormalizeContenthash(expected);
        }
        catch
        {
            return false;
        }
    }

    private static string NormalizeContenthash(string value)
    {
        var trimmed = value;
        if (trimmed.StartsWith("ipfs://", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["ipfs://".Length..];
        }
        else if (trimmed.StartsWith("/ipfs/", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["/ipfs/".Length..];
        }

        return Cid.Parse(trimmed).ToV1().ToString();
    }

    private static string? FormatAddress(string? address)
    {
        if (string.IsNullOrEmpty(address) || address == ENSService.ENS_ZERO_ADDRESS)
        {
            return null;
        }

        return new AddressUtil().ConvertToChecksumAddress(address);
    }

    private static string LoadRpcUrl()
    {
        var fromEnv = Environment.GetEnvironmentVariable("RPC_URL");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return fromEnv.Trim();
        }

        var envPath = Path.Combine(RootDir(), ".env");
        if (!File.Exists(envPath))
        {
            throw new Exception("RPC_URL environment variable is required");
        }

        foreach (var rawLine in File.ReadAllLines(envPath))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#') || !line.Contains('='))
            {
                continue;
            }

            var parts = line.Split('=', 2);
            if (parts[0].Trim() != "RPC_URL")
            {
                continue;
            }

            var value = parts[1].Trim().Trim('"', '\'');
            if (value.Length > 0)
            {
                return value;
            }
        }

        throw new Exception("RPC_URL environment variable is required");
    }

    private static string PackageDir() =>
        Path.GetDirectoryName(typeof(ResolutionTests).Assembly.Location) is { } loc
            ? FindPackageDir(loc)
            : Directory.GetCurrentDirectory();

    private static string FindPackageDir(string start)
    {
        var dir = new DirectoryInfo(start);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Nethereum.Ens.Tests.csproj")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        return Directory.GetCurrentDirectory();
    }

    private static string RootDir() =>
        Path.GetFullPath(Path.Combine(PackageDir(), "..", ".."));

    private static IEnumerable<TestCase> LoadReadyCases(string category)
    {
        var path = Path.Combine(RootDir(), "test-cases.json");
        var json = File.ReadAllText(path);
        var cases = JsonSerializer.Deserialize<List<TestCase>>(json, JsonOptions)
            ?? throw new Exception("failed to parse test-cases.json");

        return cases.Where(c =>
            c.Status == "ready"
            && c.Category == category
            && !UnsupportedMethods.Contains(c.Method));
    }

    private static void RecordResult(
        string caseId,
        bool passed,
        string? actual,
        string? error,
        long durationMs)
    {
        lock (ResultsLock)
        {
            Results.RemoveAll(r => r.CaseId == caseId);
            Results.Add(new TestResult
            {
                CaseId = caseId,
                Passed = passed,
                Actual = actual,
                Error = error,
                DurationMs = durationMs,
            });
        }
    }

    private static void WriteResults()
    {
        lock (ResultsLock)
        {
            var output = new LibraryResults
            {
                Timestamp = DateTime.UtcNow.ToString("o"),
                Results = Results.ToList(),
            };
            var path = Path.Combine(PackageDir(), "results.json");
            File.WriteAllText(path, JsonSerializer.Serialize(output, JsonOptions) + "\n");
            Console.WriteLine($"\nResults written to {path}");
        }
    }

    private static string? ExpectedValue(TestCase c) =>
        c.Expected.Address ?? c.Expected.Value ?? c.Expected.Name;

    private static string TruncateErr(Exception ex)
    {
        var msg = ex.Message;
        return msg.Length > 500 ? msg[..500] + "…" : msg;
    }

    private static ulong? ParamUInt64(JsonElement paramsEl, string key)
    {
        if (paramsEl.ValueKind != JsonValueKind.Object || !paramsEl.TryGetProperty(key, out var v))
        {
            return null;
        }

        return v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetUInt64(out var n) => n,
            JsonValueKind.Number when v.TryGetDouble(out var d) => (ulong)d,
            _ => null,
        };
    }

    private static string? ParamString(JsonElement paramsEl, string key)
    {
        if (paramsEl.ValueKind != JsonValueKind.Object || !paramsEl.TryGetProperty(key, out var v))
        {
            return null;
        }

        return v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    }

    private static string PtrOrNull(string? s) => s ?? "null";

    private sealed class TestCase
    {
        public string Id { get; set; } = "";
        public string Category { get; set; } = "";
        public string Status { get; set; } = "";
        public string Method { get; set; } = "";
        public TestCaseInput Input { get; set; } = new();
        public TestCaseExpected Expected { get; set; } = new();
        public JsonElement Params { get; set; }
    }

    private sealed class TestCaseInput
    {
        public string? Name { get; set; }
        public string? Address { get; set; }
        public int? ChainId { get; set; }
    }

    private sealed class TestCaseExpected
    {
        public string? Address { get; set; }
        public string? Value { get; set; }
        public string? Name { get; set; }
    }

    private sealed class TestResult
    {
        public string CaseId { get; set; } = "";
        public bool Passed { get; set; }
        public string? Actual { get; set; }
        public string? Error { get; set; }
        public long DurationMs { get; set; }
    }

    private sealed class LibraryResults
    {
        public string Timestamp { get; set; } = "";
        public List<TestResult> Results { get; set; } = new();
    }
}
