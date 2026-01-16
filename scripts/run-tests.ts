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

  return result.status === 0;
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
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const { pkg, passed } of results) {
    const status = passed ? "\u2705" : "\u274c";
    console.log(`${status} ${pkg.name}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
