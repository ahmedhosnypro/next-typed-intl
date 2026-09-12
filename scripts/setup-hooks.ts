/**
 * Wires `core.hooksPath` to `.git-hooks` for this repo's own checkout.
 * Bails silently when running as a dependency install elsewhere (INIT_CWD
 * differs from cwd) or when the checkout lacks .git / .git-hooks.
 */

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";

const cwd = process.cwd();

if (!existsSync(".git") || !existsSync(".git-hooks")) {
  process.exit(0);
}

const initCwd = process.env.INIT_CWD;
if (initCwd) {
  try {
    if (realpathSync(initCwd) !== realpathSync(cwd)) {
      process.exit(0);
    }
  } catch {
    process.exit(0);
  }
}

const result = spawnSync("git", ["config", "core.hooksPath", ".git-hooks"], { cwd, stdio: "inherit" });
if (result.error || result.status !== 0) {
  console.error("setup-hooks: failed to set core.hooksPath to .git-hooks");
}
process.exit(result.status ?? 1);
