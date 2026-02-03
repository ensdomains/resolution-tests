export * from "./types";

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestCase } from "./types";

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

// Filter test cases by category
export function getTestCasesByCategory(category: string): TestCase[] {
  return getReadyTestCases().filter((c) => c.category === category);
}
