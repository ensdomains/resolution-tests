import { describe, test, afterAll } from "bun:test";
import { Address, createPublicClient, getAddress, http } from "viem";
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

describe("ENS Resolution Tests - viem v2", () => {
  afterAll(() => {
    const output: LibraryResults = {
      library: "viem",
      version: "2.21.0",
      language: "typescript",
      timestamp: new Date().toISOString(),
      results,
    };

    const outputPath = join(__dirname, "../results.json");
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults written to ${outputPath}`);
  });

  describe("Forward Resolution", () => {
    const forwardCases = getTestCasesByCategory("forward");

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
            actual = getAddress(actual as Address);
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual = await client.getEnsText({
              name: normalize(testCase.input.name!),
              key,
            });
          } else if (testCase.method === "contenthash") {
            // viem doesn't have a direct contenthash method
            actual = null;
          }

          const durationMs = Date.now() - start;
          const expected =
            testCase.expected.address || testCase.expected.value || null;

          // Handle TODO expected values - record but don't compare
          if (expected === "TODO") {
            console.log(`  [${testCase.id}] Expected: TODO, Actual: ${actual}`);
            recordResult(testCase.id, true, actual, "Expected value is TODO - needs configuration", durationMs);
            return;
          }

          const passed = actual === expected;

          if (passed) {
            console.log(`  [${testCase.id}] PASS`);
          } else {
            console.log(`  [${testCase.id}] FAIL - Expected: ${expected}, Actual: ${actual}`);
          }

          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`,
            durationMs
          );
        } catch (error) {
          const durationMs = Date.now() - start;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`  [${testCase.id}] ERROR - ${errorMsg}`);
          recordResult(testCase.id, false, null, errorMsg, durationMs);
        }
      });
    }
  });

  describe("Reverse Resolution", () => {
    const reverseCases = getTestCasesByCategory("reverse");

    for (const testCase of reverseCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "reverse") {
            actual = await client.getEnsName({
              address: testCase.input.address as `0x${string}`,
            });
          } else if (testCase.method === "reverse-l2") {
            actual = null;
          }

          const durationMs = Date.now() - start;
          const expected = testCase.expected.name || null;

          // Handle TODO expected values
          if (expected === "TODO") {
            console.log(`  [${testCase.id}] Expected: TODO, Actual: ${actual}`);
            recordResult(testCase.id, true, actual, "Expected value is TODO - needs configuration", durationMs);
            return;
          }

          const passed = actual === expected;

          if (passed) {
            console.log(`  [${testCase.id}] PASS`);
          } else {
            console.log(`  [${testCase.id}] FAIL - Expected: ${expected}, Actual: ${actual}`);
          }

          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`,
            durationMs
          );
        } catch (error) {
          const durationMs = Date.now() - start;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`  [${testCase.id}] ERROR - ${errorMsg}`);
          recordResult(testCase.id, false, null, errorMsg, durationMs);
        }
      });
    }
  });
});
