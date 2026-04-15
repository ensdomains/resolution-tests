import { describe, test, expect, afterAll } from "bun:test";
import {
  Address,
  createPublicClient,
  getAddress,
  http,
  toCoinType,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize as normalizeName } from "viem/ens";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getExpectedErrorResult,
  getExpectedValue,
  getTestCasesByCategory,
  type TestResult,
  type LibraryResults,
} from "../../../shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Results collection
const results: TestResult[] = [];

// Setup client
const RPC_URL = process.env.RPC_URL;
let client: ReturnType<typeof createPublicClient> | undefined;

function getClient() {
  if (!RPC_URL) {
    throw new Error("RPC_URL environment variable is required");
  }

  client ??= createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });

  return client;
}

// Helper to record result
function recordResult(
  caseId: string,
  passed: boolean,
  actual: string | null,
  error: string | null
) {
  results.push({ caseId, passed, actual, error });
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
        try {
          let actual: string | null = null;
          // Viem expects callers to normalize ENS names before resolution,
          // so we do it in the test. Apps should generally normalize at the
          // input/app layer before calling ENS resolution helpers.
          const name = normalizeName(testCase.input.name!);

          if (testCase.method === "addr") {
            const coinType = testCase.params.coinType as number;

            actual = await getClient().getEnsAddress({
              name,
              coinType: BigInt(coinType),
            });

            // Checksum
            if (actual) {
              actual = getAddress(actual as Address);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual = await getClient().getEnsText({
              name,
              key,
            });
          }

          const expectedErrorResult = getExpectedErrorResult(testCase, actual, null);

          if (expectedErrorResult) {
            recordResult(
              expectedErrorResult.caseId,
              expectedErrorResult.passed,
              expectedErrorResult.actual,
              expectedErrorResult.error
            );

            expect(expectedErrorResult.passed).toBe(true);
            return;
          }

          const expected = getExpectedValue(testCase);

          const passed = actual === expected;
          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`
          );

          expect(actual).toBe(expected);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const expectedErrorResult = getExpectedErrorResult(testCase, null, errorMsg);

          if (expectedErrorResult) {
            recordResult(
              expectedErrorResult.caseId,
              expectedErrorResult.passed,
              expectedErrorResult.actual,
              expectedErrorResult.error
            );

            expect(expectedErrorResult.passed).toBe(true);
            return;
          }

          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg);
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
        try {
          let actual: string | null = null;

          actual = await getClient().getEnsName({
            address: testCase.input.address as `0x${string}`,
            coinType: testCase.input.chainId
              ? toCoinType(Number(testCase.input.chainId))
              : undefined,
          });

          const expected = getExpectedValue(testCase);

          const passed = actual === expected;
          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`
          );

          expect(actual).toBe(expected);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg);
          }
          throw error;
        }
      });
    }
  });
});
