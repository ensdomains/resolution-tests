import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

  // Return true if the test runner executed successfully
  // (exit code 0 means tests ran, regardless of pass/fail results)
  return result.status === 0;
}

function main() {
  const args = process.argv.slice(2);
  const filterLanguage = args[0];

  console.log("ENS Resolution Tests Runner");
  console.log("===========================\n");
  console.log("Note: This suite reports which tests pass/fail across libraries.");
  console.log("Failures are expected - they indicate missing library support.\n");

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

  const results: { pkg: PackageInfo; ran: boolean }[] = [];

  for (const pkg of packages) {
    const ran = runTests(pkg);
    results.push({ pkg, ran });
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("TEST RUNNER SUMMARY");
  console.log("=".repeat(60));

  const succeeded = results.filter((r) => r.ran).length;
  const failed = results.filter((r) => !r.ran).length;

  for (const { pkg, ran } of results) {
    const status = ran ? "\u2705 Ran" : "\u274c Error";
    console.log(`${status} - ${pkg.name}`);
  }

  console.log(`\n${succeeded} package(s) ran successfully, ${failed} had errors`);
  console.log("\nRun 'bun run aggregate' to see detailed pass/fail results.");

  // Always exit 0 - the purpose is to collect results, not assert all pass
  process.exit(0);
}

main();
