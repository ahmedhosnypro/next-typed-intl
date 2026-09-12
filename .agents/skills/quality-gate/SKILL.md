---
name: quality-gate
description: Run the library's full quality gate (`bun run quality-gate`) and drive every failing stage to green. Use when asked to validate the project, fix quality failures, or verify before a release/commit.
---

# Quality Gate (next-typed-intl)

Runs 9 stages sequentially, stopping at the first failure:

1. **TYPECHECK** — `tsc --noEmit` (TypeScript 7 native via `@typescript/native` alias)
2. **OXLINT** — `oxlint --deny-warnings`
3. **BIOME** — `biome check --write --unsafe` (formats/organizes in place)
4. **LINT** — `eslint .` (flat config; `no-console` in `src/`)
5. **DUPLICATES** — `jscpd` (copy-paste detection)
6. **UNUSED** — `knip` (unused files/exports/deps)
7. **TEST** — `bun test test/`
8. **BUILD** — `tsup` (5 entries + dts)
9. **PACKAGE** — `publint` + `attw --pack --profile esm-only`

## State file & resume

Progress persists in `.quality-gate-state.json`. Re-running `bun run quality-gate` resumes at the failed stage. `bun run quality-gate:fresh` clears state and runs everything. NEVER delete cache/config files; only the state file is cleared.

## Remediation rules

- **Fix the root cause.** Never add `eslint-disable` / `oxlint-disable` / `jscpd:ignore` comments and never weaken config files to pass a stage.
- **TYPECHECK**: the public types are the API contract — fix call sites, not the types.
- **DUPLICATES**: extract shared functions/modules/constants.
- **UNUSED** (knip): delete dead code, or — only if the export IS meant as public API — ensure it is re-exported from one of the 5 entry points.
- **PACKAGE**: run `bunx publint` / `bunx attw --pack --profile esm-only` directly to iterate.
- **TEST**: `test/fixtures/type-parity/bad/` MUST fail compilation — that is the assertion; never make it compile.

## Parallel fixes with subagents

When a stage reports many files (typical for LINT/DUPLICATES), dispatch one
subagent per file, in a single wave for that stage. Do not interleave stages.
After all subagents finish, re-run `bun run quality-gate` from the orchestrator.

## Pre-commit hook

`.git-hooks/pre-commit` runs `--skip=PACKAGE --readonly` (8 stages,
read-only biome). It is installed via `prepare` setting
`core.hooksPath=.git-hooks`. All lint stages fail on warnings too.

## Loop vs gate

Use `quality-loop` for quick local iterations while editing; use
`quality-gate` before committing or releasing.
