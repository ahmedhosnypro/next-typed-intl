/**
 * Quality gate for next-typed-intl: sequential stages with a state file so a
 * rerun resumes at the first failing stage. `--fresh` restarts from stage 1.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATE_FILE = join(process.cwd(), ".quality-gate-state.json");

interface Stage {
  readonly id: string;
  readonly label: string;
  readonly script: string;
  readonly hint: string;
  /** Read-only command used instead of `script` when `--readonly` is passed. */
  readonly readonlyCmd?: readonly string[];
}

const STAGES: readonly Stage[] = [
  {
    id: "TYPECHECK",
    label: "TypeScript (tsc --noEmit)",
    script: "typecheck",
    hint: "Fix type errors. Public API types are the contract — do not loosen them to silence errors.",
  },
  {
    id: "OXLINT",
    label: "oxlint",
    script: "oxlint",
    hint: "oxlint is fast and strict; fix the root cause, never add eslint-disable/oxlint-disable comments.",
  },
  {
    id: "BIOME",
    label: "Biome (format + lint + imports)",
    script: "biome:check",
    readonlyCmd: ["bunx", "@biomejs/biome", "check", "--error-on-warnings", "."],
    hint: "biome:check writes fixes in place. Re-run after fixing.",
  },
  {
    id: "LINT",
    label: "ESLint",
    script: "lint",
    hint: "ESLint enforces src purity (e.g. no-console in src/). Try `bun run lint:fix` for auto-fixables.",
  },
  {
    id: "DUPLICATES",
    label: "jscpd (copy-paste detection)",
    script: "check:duplicates",
    hint: "Never add jscpd:ignore comments or weaken .jscpd.json. Extract a shared function/module instead.",
  },
  {
    id: "UNUSED",
    label: "knip (unused exports/deps)",
    script: "check:unused",
    hint: "Remove dead exports/dependencies, or add the module to the public entry points if it IS the public API.",
  },
  {
    id: "TEST",
    label: "bun test",
    script: "test",
    hint: "Fix failing tests. The type-parity fixtures run real tsc — check their output carefully.",
  },
  {
    id: "BUILD",
    label: "tsup build",
    script: "build",
    hint: "Ensure every entry in tsup.config.ts builds and emits .d.ts.",
  },
  {
    id: "PACKAGE",
    label: "publint + attw (publish integrity)",
    script: "check:package",
    hint: "Debug with `bunx publint` and `bunx attw --pack`. These validate what consumers' bundlers/TS will actually resolve.",
  },
];

function readState(): { stage: string } | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as { stage: string };
  } catch {
    return null;
  }
}

function writeState(stageId: string): void {
  writeFileSync(STATE_FILE, JSON.stringify({ stage: stageId, lastRun: new Date().toISOString() }, null, 2));
}

function runScript(script: string, readonlyCmd?: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const [cmd, args] = readonlyCmd ? [readonlyCmd[0] ?? "true", readonlyCmd.slice(1)] : ["bun", ["run", script]];
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function parseSkipList(): Set<string> {
  const skip = new Set<string>();
  for (const arg of process.argv) {
    if (arg.startsWith("--skip=")) {
      for (const id of arg.slice("--skip=".length).split(",")) {
        skip.add(id.trim());
      }
    }
  }
  return skip;
}

async function main(): Promise<void> {
  const readonly = process.argv.includes("--readonly");
  const skip = parseSkipList();

  if (process.argv.includes("--fresh") && existsSync(STATE_FILE)) {
    rmSync(STATE_FILE);
    console.log("quality-gate: --fresh, starting from the first stage");
  }

  const stages = STAGES.filter((s) => !skip.has(s.id));
  if (stages.length !== STAGES.length) {
    console.log(`quality-gate: skipping ${STAGES.length - stages.length} stage(s): ${[...skip].join(", ")}`);
  }

  const state = readState();
  let startIndex = 0;
  if (state) {
    const resumeAt = stages.findIndex((s) => s.id === state.stage);
    if (resumeAt > 0) {
      startIndex = resumeAt;
      console.log(`quality-gate: resuming at ${state.stage} (state file); use --fresh to restart fully`);
    }
  }

  const start = Date.now();
  const remaining = stages.slice(startIndex);

  // Stages must run sequentially by design; chain promises rather than
  // awaiting in a loop so the runner stays rule-clean.
  const finalCode = await remaining.reduce<Promise<number>>(
    (chain, stage, offset) =>
      chain.then(async (prev) => {
        if (prev !== 0 || !stage) return prev;
        const i = startIndex + offset;
        console.log(`\n=== [${i + 1}/${stages.length}] ${stage.id}: ${stage.label} ===`);
        const code = await runScript(stage.script, readonly ? stage.readonlyCmd : undefined);
        if (code !== 0) {
          writeState(stage.id);
          console.error(`\nquality-gate FAILED at stage ${stage.id}.`);
          console.error(`Hint: ${stage.hint}`);
          console.error("Fix, then re-run `bun run quality-gate` to resume.");
        }
        return code;
      }),
    Promise.resolve(0)
  );

  if (finalCode !== 0) {
    process.exit(1);
  }

  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
  console.log(`\nquality-gate: ALL ${stages.length} STAGES PASSED in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

await main();
