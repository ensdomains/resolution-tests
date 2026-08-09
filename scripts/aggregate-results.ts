import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { TestCase, LibraryResults } from "../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface PackageResults {
  name: string;
  data: LibraryResults;
}

function loadPackageResults(): PackageResults[] {
  const packagesDir = join(ROOT, "packages");
  const results: PackageResults[] = [];

  if (!existsSync(packagesDir)) {
    return results;
  }

  for (const pkg of readdirSync(packagesDir)) {
    const resultsPath = join(packagesDir, pkg, "results.json");
    if (existsSync(resultsPath)) {
      const content = readFileSync(resultsPath, "utf-8");
      results.push({ name: pkg, data: JSON.parse(content) as LibraryResults });
    }
  }

  return results;
}

function loadTestCases(): TestCase[] {
  const testCasesPath = join(ROOT, "test-cases.json");
  const content = readFileSync(testCasesPath, "utf-8");
  const data = JSON.parse(content) as TestCase[];
  return data;
}

function generateMarkdown(
  testCases: TestCase[],
  packages: PackageResults[]
): string {
  const readyCases = testCases.filter((tc) => tc.status === "ready");
  const lines: string[] = [];

  lines.push("# ENS Resolution Test Results\n");
  lines.push(`Generated: ${new Date().toISOString()}\n`);
  lines.push("## Feature Support\n");
  lines.push(
    "| Test Case | " + packages.map((p) => p.name).join(" | ") + " |"
  );
  lines.push("|-----------|" + packages.map(() => ":---:").join("|") + "|");

  for (const testCase of readyCases) {
    const row = [testCase.id];

    for (const pkg of packages) {
      const result = pkg.data.results.find((r) => r.caseId === testCase.id);
      if (!result) {
        row.push("-");
      } else if (result.passed) {
        row.push("✅");
      } else {
        row.push("❌");
      }
    }

    lines.push("| " + row.join(" | ") + " |");
  }

  const totals = ["**TOTAL**"];
  for (const pkg of packages) {
    const passed = pkg.data.results.filter((r) => r.passed).length;
    totals.push(`**${passed}/${readyCases.length}**`);
  }
  lines.push("| " + totals.join(" | ") + " |");

  lines.push("\n### Legend\n");
  lines.push("- ✅ Pass");
  lines.push("- ❌ Fail");
  lines.push("- `-` Not tested");

  return lines.join("\n");
}

function generateCSV(
  testCases: TestCase[],
  packages: PackageResults[]
): string {
  const readyCases = testCases.filter((tc) => tc.status === "ready");
  let csv = "test_case," + packages.map((p) => p.name).join(",") + "\n";

  for (const testCase of readyCases) {
    const row = [testCase.id];

    for (const pkg of packages) {
      const result = pkg.data.results.find((r) => r.caseId === testCase.id);
      if (!result) {
        row.push("");
      } else if (result.passed) {
        row.push("pass");
      } else {
        row.push("fail");
      }
    }

    csv += row.join(",") + "\n";
  }

  return csv;
}

function main() {
  console.log("Aggregating test results...\n");

  const packages = loadPackageResults();
  console.log(`Found ${packages.length} results file(s):`);
  packages.forEach((p) => console.log(`  - ${p.name}`));

  if (packages.length === 0) {
    console.log("\nNo results files found. Run tests first.");
    process.exit(0);
  }

  const testCases = loadTestCases();

  const markdown = generateMarkdown(testCases, packages);
  const csv = generateCSV(testCases, packages);

  const resultsDir = join(ROOT, "results");
  const mdPath = join(resultsDir, "latest.md");
  writeFileSync(mdPath, markdown);
  writeFileSync(join(resultsDir, "latest.csv"), csv);
  spawnSync("npx", ["prettier", "--write", mdPath], {
    cwd: ROOT,
    stdio: "ignore",
  });

  console.log("\nResults written to:");
  console.log("  - results/latest.md");
  console.log("  - results/latest.csv");

  // Also print markdown to stdout for CI
  console.log("\n" + "=".repeat(60) + "\n");
  console.log(markdown);
}

main();
