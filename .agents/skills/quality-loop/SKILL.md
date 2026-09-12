---
name: quality-loop
description: Fast local quality loop for next-typed-intl — typecheck, oxlint, biome, eslint in sequence until green. Use while iterating on code, before running the full quality gate.
---

# Quality Loop (next-typed-intl)

`bun run quality-loop` runs, in order, exiting at the first failure:

1. `tsc --noEmit` (TypeScript 7 native)
2. `oxlint --deny-warnings`
3. `biome check` (read-only; with `--fix` it runs `biome check --write --unsafe`)
4. `eslint .` (with `--fix` it runs `eslint . --fix`)

## Usage

```bash
bun run quality-loop          # verify
bun run quality-loop --fix    # auto-fix what biome/eslint can, then re-check
```

## When to use which

- **quality-loop**: every small edit; iterate here until clean.
- **quality-gate**: before committing or publishing — additionally covers jscpd, knip, tests, build, publint, attw.

## Fix guidance

- Type errors: the library's generic types are the contract — fix call sites.
- Lint errors: no disable comments; restructure the code instead.
- biome formatting: let `--fix` apply; biome owns formatting and import order.
