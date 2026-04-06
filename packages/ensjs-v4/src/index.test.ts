import { describe, test, expect, afterAll } from "bun:test";
import { createPublicClient, http, getAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import { addEnsContracts } from "@ensdomains/ensjs";
import { getAddressRecord } from "@ensdomains/ensjs/public";
import { getTextRecord } from "@ensdomains/ensjs/public";
import { getContentHashRecord } from "@ensdomains/ensjs/public";
import { getName } from "@ensdomains/ensjs/public";
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

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

const client = createPublicClient({
  chain: addEnsContracts(mainnet),
  transport: http(RPC_URL),
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

describe("ENS Resolution Tests - ensjs v4", () => {
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
    const forwardCases = getTestCasesByCategory("forward");

    for (const testCase of forwardCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "addr") {
            const coinType = testCase.params.coinType as number;
            const result = await getAddressRecord(client, {
              name: testCase.input.name!,
              coin: coinType,
            });
            actual = result?.value ?? null;
            if (actual) {
              actual = getAddress(actual as Address);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual = await getTextRecord(client, {
              name: testCase.input.name!,
              key,
            });
          } else if (testCase.method === "contenthash") {
            const result = await getContentHashRecord(client, {
              name: testCase.input.name!,
            });
            if (result) {
              actual = `${result.protocolType}://${result.decoded}`;
            }
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
    const reverseCases = getTestCasesByCategory("reverse");

    for (const testCase of reverseCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          const result = await getName(client, {
            address: testCase.input.address as Address,
            ...(testCase.input.chainId
              ? { chainId: testCase.input.chainId }
              : {}),
          });

          actual = result?.name ?? null;

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
