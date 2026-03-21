import { describe, test, expect, afterAll } from "bun:test";
import { ethers } from "ethers";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CID } from "multiformats/cid";

import {
  getTestCasesByCategory,
  type TestResult,
  type LibraryResults,
} from "../../../shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Results collection
const results: TestResult[] = [];

// Setup provider
const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

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

describe("ENS Resolution Tests - ethers v5", () => {
  afterAll(() => {
    const output: LibraryResults = {
      library: "ethers",
      version: "5.7.2",
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
            const name = testCase.input.name!;

            const resolver = await provider.getResolver(name);
            if (resolver) {
              actual = await resolver.getAddress(coinType);
            }

            // Checksum address
            if (actual) {
              actual = ethers.utils.getAddress(actual);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            const name = testCase.input.name!;

            const resolver = await provider.getResolver(name);
            if (resolver) {
              actual = await resolver.getText(key);
            }
          } else if (testCase.method === "contenthash") {
            const name = testCase.input.name!;

            const resolver = await provider.getResolver(name);
            if (resolver) {
              actual = await resolver.getContentHash();
            }
          }

          const durationMs = Date.now() - start;
          const expected =
            testCase.expected.address || testCase.expected.value || null;

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
            passed ? null : `Expected ${expected}, got ${actual}`,
            durationMs
          );

          expect(passed).toBe(true);
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
    const reverseCases = getTestCasesByCategory("reverse");

    for (const testCase of reverseCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "reverse") {
            actual = await provider.lookupAddress(testCase.input.address!);
          } else if (testCase.method === "reverse-l2") {
            // L2 reverse resolution not directly supported in ethers v5
            actual = null;
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
