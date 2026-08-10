import { describe, test, expect, afterAll } from "bun:test";
import { createThirdwebClient, defineChain, getAddress } from "thirdweb";
import {
  resolveAddress,
  resolveName,
  resolveText,
  resolveL2Name,
  BASENAME_RESOLVER_ADDRESS,
} from "thirdweb/extensions/ens";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getTestCasesByCategory,
  type TestResult,
  type LibraryResults,
} from "../../../shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

const results: TestResult[] = [];

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const THIRDWEB_CLIENT_ID = process.env.THIRDWEB_CLIENT_ID;
// Client credentials are required by the SDK; when custom RPCs are set below,
// a placeholder clientId is enough because calls never hit thirdweb's gateway.
const client = createThirdwebClient(
  THIRDWEB_SECRET_KEY
    ? { secretKey: THIRDWEB_SECRET_KEY }
    : { clientId: THIRDWEB_CLIENT_ID || "ens-resolution-tests" }
);

// Prefer suite / public RPCs so results don't depend on thirdweb gateway auth
const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}
const mainnet = defineChain({ id: 1, rpc: RPC_URL });
const baseChain = defineChain({
  id: 8453,
  rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org",
});

function recordResult(
  caseId: string,
  passed: boolean,
  actual: string | null,
  error: string | null,
  durationMs: number
) {
  results.push({ caseId, passed, actual, error, durationMs });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    // thirdweb often nests the RPC revert body in message; prefer OffchainLookup hint
    const offchain = detectOffchainLookup(error.message);
    if (offchain) return offchain;
    return error.message;
  }
  if (typeof error === "string") {
    return detectOffchainLookup(error) ?? error;
  }
  try {
    const json = JSON.stringify(error);
    return detectOffchainLookup(json) ?? json;
  } catch {
    return String(error);
  }
}

function detectOffchainLookup(text: string): string | null {
  // OffchainLookup(address,string[],bytes,bytes4,bytes) selector
  if (text.includes("0x556f1830")) {
    return "OffchainLookup not handled (CCIP-Read)";
  }
  return null;
}

// No coinType / contenthash public APIs in thirdweb ENS extensions
const unsupportedMethods = ["contenthash"];

function isUnsupportedAddrCase(testCase: {
  method: string;
  params: Record<string, unknown>;
}): boolean {
  if (testCase.method !== "addr") return false;
  const coinType = testCase.params.coinType;
  return typeof coinType === "number" && coinType !== 60;
}

describe("ENS Resolution Tests - thirdweb v5", () => {
  afterAll(() => {
    const output: LibraryResults = {
      timestamp: new Date().toISOString(),
      results,
    };

    const outputPath = join(__dirname, "../results.json");
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults written to ${outputPath}`);
  });

  describe("Forward Resolution", () => {
    const forwardCases = getTestCasesByCategory("forward", unsupportedMethods);

    for (const testCase of forwardCases) {
      // resolveAddress only resolves ETH (coin type 60)
      if (isUnsupportedAddrCase(testCase)) {
        // Leave unrecorded so the feature table shows `-`
        test.skip(testCase.description, () => {});
        continue;
      }

      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "addr") {
            const result = await resolveAddress({
              client,
              name: testCase.input.name!,
              resolverChain: mainnet,
            });
            if (result) {
              actual = getAddress(result);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual =
              (await resolveText({
                client,
                name: testCase.input.name!,
                key,
                resolverChain: mainnet,
              })) ?? null;
          }

          const durationMs = Date.now() - start;
          const expected =
            testCase.expected.address || testCase.expected.value || null;

          const passed = actual === expected;
          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`,
            durationMs
          );

          expect(actual).toBe(expected);
        } catch (error) {
          const durationMs = Date.now() - start;
          const errorMsg = formatError(error);
          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg, durationMs);
          }
          throw error;
        }
      });
    }
  });

  describe("Reverse Resolution", () => {
    const reverseCases = getTestCasesByCategory("reverse", unsupportedMethods);

    for (const testCase of reverseCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "reverse") {
            actual = await resolveName({
              client,
              address: testCase.input.address as `0x${string}`,
              resolverChain: mainnet,
            });
          } else if (testCase.method === "reverse-l2") {
            // Public L2 reverse API is Basename-oriented (not ENS V2 L2 primary)
            actual = await resolveL2Name({
              client,
              address: testCase.input.address as `0x${string}`,
              resolverAddress: BASENAME_RESOLVER_ADDRESS,
              resolverChain: baseChain,
            });
          }

          const durationMs = Date.now() - start;
          const expected = testCase.expected.name || null;

          const passed = actual === expected;
          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`,
            durationMs
          );

          expect(actual).toBe(expected);
        } catch (error) {
          const durationMs = Date.now() - start;
          const errorMsg = formatError(error);
          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg, durationMs);
          }
          throw error;
        }
      });
    }
  });
});
