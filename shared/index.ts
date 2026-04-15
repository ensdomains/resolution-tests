export * from "./types";

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestCase, TestResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load test cases from the root test-cases.json
export function loadTestCases(): TestCase[] {
  const testCasesPath = join(__dirname, "../test-cases.json");
  return JSON.parse(readFileSync(testCasesPath, "utf-8"));
}

// Get only test cases with status "ready"
export function getReadyTestCases() {
  return loadTestCases().filter((c) => c.status === "ready");
}

// Filter test cases by category, optionally excluding unsupported methods
export function getTestCasesByCategory(
  category: string,
  unsupportedMethods?: string[]
): TestCase[] {
  return getReadyTestCases().filter(
    (c) =>
      c.category === category &&
      (!unsupportedMethods || !unsupportedMethods.includes(c.method))
  );
}

export function getExpectedValue(testCase: Pick<TestCase, "expected">) {
  return (
    testCase.expected.address ||
    testCase.expected.value ||
    testCase.expected.name ||
    null
  );
}

export function getExpectedErrorResult(
  testCase: Pick<TestCase, "id" | "expected">,
  actual: string | null,
  error: string | null,
  durationMs: number
): TestResult | null {
  if (testCase.expected.error !== true) {
    return null;
  }

  if (error !== null) {
    return {
      caseId: testCase.id,
      passed: true,
      actual: null,
      error,
      durationMs,
    };
  }

  return {
    caseId: testCase.id,
    passed: false,
    actual,
    error: `Expected an error, got ${actual}`,
    durationMs,
  };
}
