/**
 * Fast local loop for iterative fixing: typecheck → oxlint → biome → eslint.
 * Exits at the first failing check. `--fix` uses the write-enabled variants.
 */

import { spawn } from "node:child_process";

const FIX_MODE = process.argv.includes("--fix");

const CHECKS: ReadonlyArray<readonly [string, string[]]> = [
  ["typecheck", ["bunx", "tsc", "--noEmit"]],
  ["oxlint", ["bunx", "oxlint", "--deny-warnings", "--ignore-path", ".gitignore"]],
  [
    "biome",
    FIX_MODE
      ? ["bunx", "@biomejs/biome", "check", "--write", "--unsafe", "."]
      : ["bunx", "@biomejs/biome", "check", "."],
  ],
  ["eslint", FIX_MODE ? ["bunx", "eslint", ".", "--fix"] : ["bunx", "eslint", "."]],
];

function run(cmd: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd[0] ?? "", cmd.slice(1), { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const finalCode = await CHECKS.reduce<Promise<number>>(
  (chain, [label, cmd]) =>
    chain.then(async (prev) => {
      if (prev !== 0) return prev;
      console.log(`\n--- quality-loop: ${label} ---`);
      const code = await run(cmd);
      if (code !== 0) {
        console.error(`quality-loop: ${label} FAILED. Fix the output above, then re-run.`);
      }
      return code;
    }),
  Promise.resolve(0)
);

if (finalCode !== 0) {
  process.exit(1);
}

console.log("\nquality-loop: clean (typecheck, oxlint, biome, eslint)");
