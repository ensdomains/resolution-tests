import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { TestCase, LibraryResults } from "../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");

type Language = "typescript" | "python" | "rust" | "go";

interface PackageInfo {
  name: string;
  path: string;
  language: Language;
}

function detectLanguage(pkgPath: string): Language | null {
  if (existsSync(join(pkgPath, "package.json"))) return "typescript";
  if (existsSync(join(pkgPath, "Cargo.toml"))) return "rust";
  if (existsSync(join(pkgPath, "pyproject.toml"))) return "python";
  if (existsSync(join(pkgPath, "go.mod"))) return "go";
  return null;
}

function discoverPackages(filterLanguage?: string): PackageInfo[] {
  const packages: PackageInfo[] = [];

  if (!existsSync(PACKAGES_DIR)) {
    return packages;
  }

  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, pkg);
    const language = detectLanguage(pkgPath);

    if (!language) continue;
    if (filterLanguage && language !== filterLanguage) continue;

    packages.push({ name: pkg, path: pkgPath, language });
  }

  return packages;
}

function runTests(pkg: PackageInfo): boolean {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running tests for ${pkg.name} (${pkg.language})`);
  console.log("=".repeat(60));

  let command: string;
  let args: string[];

  switch (pkg.language) {
    case "typescript":
      command = "bun";
      args = ["test"];
      break;
    case "python":
      command = "python";
      args = ["-m", "pytest"];
      break;
    case "rust":
      command = "cargo";
      args = ["test"];
      break;
    case "go":
      command = "go";
      args = ["test", "./..."];
      break;
    default:
      console.log(`Unknown language: ${pkg.language}`);
      return false;
  }

  const result = spawnSync(command, args, {
    cwd: pkg.path,
    stdio: "inherit",
    env: process.env,
  });

  return result.status === 0;
}

function loadTestCases(): TestCase[] {
  const testCasesPath = join(ROOT, "test-cases.json");
  const content = readFileSync(testCasesPath, "utf-8");
  const data = JSON.parse(content) as TestCase[];
  return data;
}

function loadLibraryResults(pkgPath: string): LibraryResults | null {
  const resultsPath = join(pkgPath, "results.json");
  if (!existsSync(resultsPath)) {
    return null;
  }
  const content = readFileSync(resultsPath, "utf-8");
  return JSON.parse(content) as LibraryResults;
}

function generateFeatureTable(
  packages: PackageInfo[],
  testCases: TestCase[]
): { console: string; markdown: string } {
  // Load results for each package
  const allResults: { pkg: PackageInfo; results: LibraryResults | null }[] = [];
  for (const pkg of packages) {
    allResults.push({ pkg, results: loadLibraryResults(pkg.path) });
  }

  // Filter to only "ready" test cases
  const readyCases = testCases.filter((tc) => tc.status === "ready");

  // Calculate column widths for console output
  const idWidth = Math.max(
    "Test Case".length,
    ...readyCases.map((tc) => tc.id.length)
  );
  const libWidth = Math.max(6, ...packages.map((p) => p.name.length));

  const consoleLines: string[] = [];
  const mdLines: string[] = [];

  // Console header
  const headerCols = [
    "Test Case".padEnd(idWidth),
    ...packages.map((p) => p.name.padEnd(libWidth)),
  ];
  consoleLines.push(headerCols.join(" | "));
  consoleLines.push(
    headerCols.map((col) => "-".repeat(col.length)).join("-+-")
  );

  // Markdown header
  mdLines.push("# ENS Resolution Test Results\n");
  mdLines.push(`Generated: ${new Date().toISOString()}\n`);
  mdLines.push("## Feature Support\n");
  mdLines.push(
    "| Test Case | " + packages.map((p) => p.name).join(" | ") + " |"
  );
  mdLines.push("|-----------|" + packages.map(() => ":---:").join("|") + "|");

  // Each test case row
  for (const testCase of readyCases) {
    const consoleRow = [testCase.id.padEnd(idWidth)];
    const mdRow = [testCase.id];

    for (const { results } of allResults) {
      if (!results) {
        consoleRow.push("-".padEnd(libWidth));
        mdRow.push("-");
      } else {
        const result = results.results.find((r) => r.caseId === testCase.id);
        if (!result) {
          consoleRow.push("-".padEnd(libWidth));
          mdRow.push("-");
        } else if (result.passed) {
          consoleRow.push("✅".padEnd(libWidth - 1));
          mdRow.push("✅");
        } else {
          consoleRow.push("❌".padEnd(libWidth - 1));
          mdRow.push("❌");
        }
      }
    }

    consoleLines.push(consoleRow.join(" | "));
    mdLines.push("| " + mdRow.join(" | ") + " |");
  }

  // Totals row
  consoleLines.push(
    headerCols.map((col) => "-".repeat(col.length)).join("-+-")
  );
  const consoleTotals = ["TOTAL".padEnd(idWidth)];
  const mdTotals = ["**TOTAL**"];

  for (const { results } of allResults) {
    if (!results) {
      consoleTotals.push("-".padEnd(libWidth));
      mdTotals.push("-");
    } else {
      const passed = results.results.filter((r) => r.passed).length;
      const total = results.results.length;
      consoleTotals.push(`${passed}/${total}`.padEnd(libWidth));
      mdTotals.push(`**${passed}/${total}**`);
    }
  }
  consoleLines.push(consoleTotals.join(" | "));
  mdLines.push("| " + mdTotals.join(" | ") + " |");

  // Markdown legend
  mdLines.push("\n### Legend\n");
  mdLines.push("- ✅ Pass");
  mdLines.push("- ❌ Fail");
  mdLines.push("- `-` Not tested");

  return {
    console: consoleLines.join("\n"),
    markdown: mdLines.join("\n"),
  };
}

function main() {
  const args = process.argv.slice(2);
  const filterLanguage = args[0];

  console.log("ENS Resolution Tests Runner");
  console.log("===========================\n");

  const packages = discoverPackages(filterLanguage);

  if (packages.length === 0) {
    console.log("No packages found to test.");
    if (filterLanguage) {
      console.log(`  Filtered by language: ${filterLanguage}`);
    }
    process.exit(0);
  }

  console.log(`Found ${packages.length} package(s) to test:`);
  packages.forEach((p) => console.log(`  - ${p.name} (${p.language})`));

  const results: { pkg: PackageInfo; passed: boolean }[] = [];

  for (const pkg of packages) {
    const passed = runTests(pkg);
    results.push({ pkg, passed });
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("FEATURE SUPPORT TABLE");
  console.log("=".repeat(60));

  const testCases = loadTestCases();
  const featureTable = generateFeatureTable(
    results.map((r) => r.pkg),
    testCases
  );

  console.log(featureTable.console);
  console.log("\nLegend: ✅ Pass | ❌ Fail | - Not tested");

  // Save markdown to results/latest.md
  const resultsPath = join(ROOT, "results", "latest.md");
  writeFileSync(resultsPath, featureTable.markdown);
  spawnSync("npx", ["prettier", "--write", resultsPath], {
    cwd: ROOT,
    stdio: "ignore",
  });
  console.log(`\nResults saved to: results/latest.md`);

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main();
