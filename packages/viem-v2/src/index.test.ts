import { describe, test, expect, afterAll } from "bun:test";
import {
  Address,
  createPublicClient,
  getAddress,
  http,
  toCoinType,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getTestCasesByCategory,
  type TestResult,
  type LibraryResults,
} from "../../../shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Results collection
const results: TestResult[] = [];

// Setup client
const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

// Helper to record result
function recordResult(
  caseId: string,
  passed: boolean,
  actual: string | null,
  error: string | null,
  durationMs: number
) {
  results.push({ caseId, passed, actual, error, durationMs });
}

const unsupportedMethods = ["contenthash"];

describe("ENS Resolution Tests - viem v2", () => {
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
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "addr") {
            const coinType = testCase.params.coinType as number;

            actual = await client.getEnsAddress({
              name: normalize(testCase.input.name!),
              coinType: BigInt(coinType),
            });

            // Checksum
            if (actual) {
              actual = getAddress(actual as Address);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual = await client.getEnsText({
              name: normalize(testCase.input.name!),
              key,
            });
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
          const errorMsg =
            error instanceof Error ? error.message : String(error);
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

          actual = await client.getEnsName({
            address: testCase.input.address as `0x${string}`,
            coinType: testCase.input.chainId
              ? toCoinType(Number(testCase.input.chainId))
              : undefined,
          });

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
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg, durationMs);
          }
          throw error;
        }
      });
    }
  });
});
