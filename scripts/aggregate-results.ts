import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface TestResult {
  caseId: string;
  passed: boolean;
  actual: string | null;
  error: string | null;
  durationMs: number;
}

interface LibraryResults {
  library: string;
  version: string;
  language: string;
  timestamp: string;
  results: TestResult[];
}

interface TestCase {
  id: string;
  category: string;
  description: string;
  status: string;
}

interface TestCasesFile {
  cases: TestCase[];
}

function findResultsFiles(): string[] {
  const packagesDir = join(ROOT, "packages");
  const resultsFiles: string[] = [];

  if (!existsSync(packagesDir)) {
    return resultsFiles;
  }

  for (const pkg of readdirSync(packagesDir)) {
    const resultsPath = join(packagesDir, pkg, "results.json");
    if (existsSync(resultsPath)) {
      resultsFiles.push(resultsPath);
    }
  }

  return resultsFiles;
}

function loadResults(files: string[]): LibraryResults[] {
  return files.map((file) => {
    const content = readFileSync(file, "utf-8");
    return JSON.parse(content) as LibraryResults;
  });
}

function loadTestCases(): TestCase[] {
  const testCasesPath = join(ROOT, "test-cases.json");
  const content = readFileSync(testCasesPath, "utf-8");
  const data = JSON.parse(content) as TestCasesFile;
  return data.cases;
}

function generateMarkdown(
  testCases: TestCase[],
  allResults: LibraryResults[]
): string {
  const libraries = allResults.map((r) => `${r.library}@${r.version}`);

  let md = "# ENS Resolution Test Results\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary table
  md += "## Summary\n\n";
  md += "| Test Case | " + libraries.join(" | ") + " |\n";
  md += "|-----------|" + libraries.map(() => "---").join("|") + "|\n";

  for (const testCase of testCases) {
    const row = [testCase.id];

    for (const libResult of allResults) {
      const result = libResult.results.find((r) => r.caseId === testCase.id);
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
  for (const libResult of allResults) {
    md += `### ${libResult.library}@${libResult.version} (${libResult.language})\n\n`;
    md += `Tested: ${libResult.timestamp}\n\n`;

    const passed = libResult.results.filter((r) => r.passed).length;
    const total = libResult.results.length;
    md += `**${passed}/${total} tests passed**\n\n`;

    const failures = libResult.results.filter((r) => !r.passed);
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
  allResults: LibraryResults[]
): string {
  const libraries = allResults.map((r) => `${r.library}@${r.version}`);

  let csv = "test_case," + libraries.join(",") + "\n";

  for (const testCase of testCases) {
    const row = [testCase.id];

    for (const libResult of allResults) {
      const result = libResult.results.find((r) => r.caseId === testCase.id);
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

  const resultsFiles = findResultsFiles();
  console.log(`Found ${resultsFiles.length} results file(s):`);
  resultsFiles.forEach((f) => console.log(`  - ${f}`));

  if (resultsFiles.length === 0) {
    console.log("\nNo results files found. Run tests first.");
    process.exit(0);
  }

  const allResults = loadResults(resultsFiles);
  const testCases = loadTestCases();

  const markdown = generateMarkdown(testCases, allResults);
  const csv = generateCSV(testCases, allResults);

  const resultsDir = join(ROOT, "results");
  writeFileSync(join(resultsDir, "latest.md"), markdown);
  writeFileSync(join(resultsDir, "latest.csv"), csv);

  console.log("\nResults written to:");
  console.log("  - results/latest.md");
  console.log("  - results/latest.csv");

  // Also print markdown to stdout for CI
  console.log("\n" + "=".repeat(60) + "\n");
  console.log(markdown);
}

main();
