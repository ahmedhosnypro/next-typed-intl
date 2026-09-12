import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
// These fixture assertions intentionally run under the repo's aliased TS-native
// compiler: `tsc` here resolves to `typescript@^7` via the `@typescript/native`
// alias (see the toolchain notes in AGENTS.md), so the diagnostics strings in
// its output are the TS 7.0 wordings — a future toolchain bump may require
// updating the expected messages below, not the fixtures.
const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

if (!existsSync(tscBin)) {
  throw new Error(`tsc binary not found at ${tscBin} — run \`bun install\` first`);
}

function typecheckFixture(name: "ok" | "bad"): { status: number | null; output: string } {
  const projectDir = join(repoRoot, "test", "fixtures", "type-parity", name);
  const result = spawnSync(tscBin, ["--noEmit", "-p", projectDir], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error) {
    throw new Error(`failed to spawn tsc for fixture "${name}": ${result.error.message}`);
  }
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

describe("compile-time locale parity (fixture projects)", () => {
  it("a complete pairing type-checks cleanly", () => {
    const { status, output } = typecheckFixture("ok");
    expect(status, `expected exit 0, got ${status}:\n${output}`).toBe(0);
  });

  it("a locale missing a key fails type-checking", () => {
    const { status, output } = typecheckFixture("bad");
    expect(status, `expected a non-zero exit, got null:\n${output}`).not.toBe(null);
    expect(status, `expected a non-zero exit, got ${status}:\n${output}`).not.toBe(0);
    expect(output).toContain("home");
  });
});
