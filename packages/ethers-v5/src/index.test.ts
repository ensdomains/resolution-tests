import { describe, test, expect, afterAll } from "bun:test";
import { ethers } from "ethers";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CID } from "multiformats/cid";

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

// Setup provider
const RPC_URL = process.env.RPC_URL;
let provider: ethers.providers.JsonRpcProvider | undefined;

function getProvider() {
  if (!RPC_URL) {
    throw new Error("RPC_URL environment variable is required");
  }

  provider ??= new ethers.providers.JsonRpcProvider(RPC_URL);
  return provider;
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

const unsupportedMethods = ["reverse-l2"];

describe("ENS Resolution Tests - ethers v5", () => {
  afterAll(() => {
    const output: LibraryResults = {
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
          // Ethers v5 normalizes ENS names internally on this provider resolver path.
          const name = testCase.input.name!;

          if (testCase.method === "addr") {
            const coinType = testCase.params.coinType as number;

            const resolver = await getProvider().getResolver(name);
            if (resolver) {
              actual = await resolver.getAddress(coinType);
            }

            // Checksum address
            if (actual) {
              actual = ethers.utils.getAddress(actual);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;

            const resolver = await getProvider().getResolver(name);
            if (resolver) {
              actual = await resolver.getText(key);
            }
          } else if (testCase.method === "contenthash") {
            const resolver = await getProvider().getResolver(name);
            if (resolver) {
              actual = await resolver.getContentHash();
            }
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

          // For contenthash, compare CIDs to handle v0/v1 differences
          let passed = actual === expected;
          if (
            !passed &&
            testCase.method === "contenthash" &&
            actual &&
            expected
          ) {
            const v0Cid = CID.parse(actual.replace("ipfs://", ""));
            const v1Cid = v0Cid.toV1().toString();
            const expectedCid = expected.replace("ipfs://", "");
            passed = v1Cid === expectedCid;
          }

          recordResult(
            testCase.id,
            passed,
            actual,
            passed ? null : `Expected ${expected}, got ${actual}`
          );

          expect(passed).toBe(true);
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

          if (testCase.method === "reverse") {
            actual = await getProvider().lookupAddress(testCase.input.address!);
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
          if (!results.some((r) => r.caseId === testCase.id)) {
            recordResult(testCase.id, false, null, errorMsg);
          }
          throw error;
        }
      });
    }
  });
});
