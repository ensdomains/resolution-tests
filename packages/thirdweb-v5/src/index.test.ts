import { describe, test, expect, afterAll } from "bun:test";
import { createThirdwebClient } from "thirdweb";
import {
  resolveAddress,
  resolveName,
  resolveText,
  resolveL2Name,
  BASENAME_RESOLVER_ADDRESS,
} from "thirdweb/extensions/ens";
import { base } from "thirdweb/chains";
import { getAddress } from "viem";
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
if (!THIRDWEB_SECRET_KEY) {
  throw new Error("THIRDWEB_SECRET_KEY environment variable is required");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });

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
      // Skip forward-base-onchain — resolveAddress has no coinType param
      if (testCase.id === "forward-base-onchain") {
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
            });
            if (result) {
              actual = getAddress(result);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual = await resolveText({
              client,
              name: testCase.input.name!,
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

          if (testCase.method === "reverse") {
            actual = await resolveName({
              client,
              address: testCase.input.address as `0x${string}`,
            });
          } else if (testCase.method === "reverse-l2") {
            // resolveL2Name queries the L2 resolver directly on Base
            actual = await resolveL2Name({
              client,
              address: testCase.input.address as `0x${string}`,
              resolverAddress: BASENAME_RESOLVER_ADDRESS,
              resolverChain: base,
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
