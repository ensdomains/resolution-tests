import { describe, test, expect, afterAll } from "bun:test";
import { createEnsPublicClient } from "@ensdomains/ensjs";
import { http, getAddress } from "viem";
import { mainnet } from "viem/chains";
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

const results: TestResult[] = [];

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

const client = createEnsPublicClient({
  chain: mainnet,
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

const unsupportedMethods: string[] = [];

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
    const forwardCases = getTestCasesByCategory("forward", unsupportedMethods);

    for (const testCase of forwardCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (testCase.method === "addr") {
            const coinType = testCase.params.coinType as number;
            const record = await client.getAddressRecord({
              name: testCase.input.name!,
              coin: coinType,
            });
            if (record?.value) {
              actual = getAddress(record.value);
            }
          } else if (testCase.method === "text") {
            const key = testCase.params.key as string;
            actual =
              (await client.getTextRecord({
                name: testCase.input.name!,
                key,
              })) ?? null;
          } else if (testCase.method === "contenthash") {
            const record = await client.getContentHashRecord({
              name: testCase.input.name!,
            });
            if (record?.protocolType && record.decoded) {
              actual = `${record.protocolType}://${record.decoded}`;
            }
          }

          const durationMs = Date.now() - start;
          const expected =
            testCase.expected.address || testCase.expected.value || null;

          let passed = actual === expected;
          if (
            !passed &&
            testCase.method === "contenthash" &&
            actual &&
            expected
          ) {
            const actualCid = CID.parse(actual.replace("ipfs://", ""));
            const expectedCid = expected.replace("ipfs://", "");
            passed =
              actualCid.toV1().toString() === expectedCid ||
              actualCid.toString() === expectedCid;
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
    const reverseCases = getTestCasesByCategory("reverse", unsupportedMethods);

    for (const testCase of reverseCases) {
      test(testCase.description, async () => {
        const start = Date.now();

        try {
          let actual: string | null = null;

          if (
            testCase.method === "reverse" ||
            testCase.method === "reverse-l2"
          ) {
            const result = await client.getName({
              address: testCase.input.address as `0x${string}`,
              ...(testCase.input.chainId
                ? { chainId: testCase.input.chainId }
                : {}),
            });
            actual = result?.name ?? null;
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
