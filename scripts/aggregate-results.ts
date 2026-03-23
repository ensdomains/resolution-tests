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
  let md = "# ENS Resolution Test Results\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary table
  md += "## Summary\n\n";
  md += "| Test Case | " + packages.map((p) => p.name).join(" | ") + " |\n";
  md += "|-----------|" + packages.map(() => "---").join("|") + "|\n";

  for (const testCase of testCases) {
    const row = [testCase.id];

    for (const pkg of packages) {
      const result = pkg.data.results.find((r) => r.caseId === testCase.id);
      if (!result) {
        row.push("-");
      } else if (result.passed) {
        row.push("\u2705");
      } else {
        row.push("\u274c");
      }
    }

    md += "| " + row.join(" | ") + " |\n";
  }

  // Legend
  md += "\n### Legend\n";
  md += "- \u2705 Pass\n";
  md += "- \u274c Fail\n";
  md += "- `-` Not tested\n";

  // Detailed results per library
  md += "\n## Detailed Results\n\n";
  for (const pkg of packages) {
    md += `### ${pkg.name}\n\n`;
    md += `Tested: ${pkg.data.timestamp}\n\n`;

    const passed = pkg.data.results.filter((r) => r.passed).length;
    md += `**${passed}/${testCases.length} tests passed**\n\n`;

    const failures = pkg.data.results.filter((r) => !r.passed);
    if (failures.length > 0) {
      md += "#### Failures\n\n";
      for (const failure of failures) {
        md += `- **${failure.caseId}**: ${failure.error || "Unexpected result"}\n`;
        if (failure.actual) {
          md += `  - Actual: \`${failure.actual}\`\n`;
        }
      }
      md += "\n";
    }
  }

  return md;
}

function generateCSV(
  testCases: TestCase[],
  packages: PackageResults[]
): string {
  let csv = "test_case," + packages.map((p) => p.name).join(",") + "\n";

  for (const testCase of testCases) {
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
