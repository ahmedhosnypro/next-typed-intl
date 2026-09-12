# next-typed-intl — Agent Guide

## What this repo is

A publishable TypeScript library: **compile-time type-safe i18n for Next.js**.

- Keys are **typed object properties** (`t.nav.home`), not strings — autocomplete + compile errors.
- Pluralization/interpolation are **typed functions** — `(count: number) => string` — no ICU parser, no codegen.
- **Dual delivery**: eager synchronous messages tree for the server, lazy per-namespace dynamic imports for the client (suspense read).
- Locale parity is enforced **at compile time**: every locale's messages are checked against the default locale's entry.
- Locale tags and `defaultLocale` are **canonicalized at setup** via `Intl.getCanonicalLocales` (`canonicalizeLocales`, default `true`; `false` keeps declared strings).

## Public API surface (the contract)

Six subpath exports, built from these entries — the ONLY supported import paths:

| Entry | Guards | Exports |
|---|---|---|
| `next-typed-intl` | — | `createI18n`, `createClientI18n`, `plural`/`createPlural`, `formatNumber`/`formatCurrency`/`formatDateTime`/`formatDateRange`/`formatRelativeTime`/`formatList`/`createFormatters`, `interpolate`, `DEFAULT_LOCALE_COOKIE`, `I18nError`/`I18nErrorCode`, config/handle/instance types, `SeedNamespaceOptions`, `PluralOptions`, `PlaceholderNames`, `InterpolateOptions` |
| `next-typed-intl/react` | `client-only` | `I18nProvider` (incl. `initialNamespaces`), `useTranslation` (incl. `{ suspense: false }`), `useLocale`, `useI18n`, `TranslationBoundary`, `renderRichText` (re-export), `createI18nContext`, `createNavigation` (`Link`/`usePathname`/`useRouter`/`getPathname` for prefix-mode routing) |
| `next-typed-intl/rich` | none (RSC-safe) | `renderRichText`, `TagNames`, `RichTextRenderers` |
| `next-typed-intl/server` | `server-only`, `next/headers` | `getMessages`, `getNamespace`, `getRequestLocale`, `setRequestLocale` (request-scoped override that keeps prefix routes statically prerenderable) |
| `next-typed-intl/next` | proxy-safe (no `next/headers`) | `createLocaleProxy` (deprecated alias: `createLocaleMiddleware`), `resolveRequestLocale`, `detectAcceptLanguage`, `getLocaleFromPathname`, `stripLocalePrefix`, `toLocalizedPathname`, `DEFAULT_LOCALE_COOKIE`, `LOCALE_HEADER` |
| `next-typed-intl/testing` | — | `assertLocaleParity` (bidirectional; throws `LOCALE_PARITY_MISMATCH` with a `.mismatches` diff), `getParityMismatches`, `ParityOptions` (`allowExtraKeys`) |

Rules:
- Any new public API must be exported from exactly one entry above and fully typed.
- Never import `next/headers` in `src/next/**` (breaks the proxy/middleware entry); never import `server-only` into `src/next/**` or `src/**` core. `src/rich/**` must stay guard-free (no `client-only`/`server-only`) — that is what makes rich text RSC-safe.
- `src/core/**` must stay framework-free (no react/next imports).

## Layout

- `src/core/` — `createI18n` factory, CLDR plurals, Intl formatters, interpolation, suspense cache, `errors.ts` (`I18nError`/`I18nErrorCode`), `negotiate.ts` (`detectAcceptLanguage`)
- `src/react/`, `src/rich/`, `src/server/`, `src/next/`, `src/testing/` — entry points
- `test/` — bun test; `test/fixtures/type-parity/{ok,bad}` are compiled by `tsc` subprocesses (the bad fixture MUST fail — do not "fix" it); `server.test.ts` covers the async server API
- `examples/` — standalone Next.js apps consuming the library via `link:next-typed-intl` (a `bun link` registration at the repo root is required first; bun's `file:` copying mishandles this repo's `.gitignore`/`files` layout, and workspaces cannot reference the root package); they have their own toolchains and are excluded from the root lint/type scope
- `docs/` — user-facing documentation: `getting-started.md`, `guides/` (one topic per page), `reference/` (one page per entry point + error codes), `migration.md`. When public API changes, update the matching docs page in the same commit.
- `scripts/quality-gate.ts`, `scripts/quality-loop.ts` — quality automation

## Commands

```bash
bun install
bun run build            # tsup: 6 entries + dts into dist/
bun run test             # bun test test/
bun run quality-loop     # fast: tsc → oxlint → biome → eslint (see .agents/skills/quality-loop)
bun run quality-gate     # full 9-stage gate incl. tests, build, publint, attw
bun run quality-gate:fresh   # ignore the resume state file
```

## Toolchain notes (do not regress)

- **TypeScript dual install (intentional)**: `typescript` is aliased to `npm:@typescript/typescript6` (TS 6 API for typescript-eslint and tsup's dts), and `@typescript/native` is aliased to `npm:typescript@^7` so `tsc` is the native 7.x compiler. Do NOT "fix" this by unifying them — see the TS 7.0 announcement's side-by-side section.
- **build is `scripts/build.ts`** — ONE tsup invocation whose single config object's `entry` map covers all six subpath exports (a tsup config array spins up parallel DTS workers that race; sharing one pipeline avoids that). After tsup, the script prepends `"use client";` onto `dist/react/index.js` (esbuild drops the source directive when bundling, and tsup's treeshake pass strips a config-level banner — so the file is patched post-build) and runs a cross-entry identity check: an error thrown by `dist/react/index.js` must be `instanceof` the `dist/index.js` `I18nError`, otherwise the bundles shipped duplicated class copies and the build fails. The dts pass needs `ignoreDeprecations: "6.0"` because rollup-plugin-dts injects a deprecated `baseUrl`.
- **attw** runs with `--profile esm-only` — the package is ESM-only by design.
- No `console.*` in `src/` (ESLint enforced). Throw errors; stay silent otherwise.
- Never add `jscpd:ignore` comments or weaken `.jscpd.json`; extract shared code instead.

## Before committing

`bun run quality-gate` must be green. For release commits also bump `version`,
update `CHANGELOG.md`, and the README if the public API changed.

CI exists: `.github/workflows/ci.yml` runs the full quality gate
(`quality-gate:fresh`) on GitHub Actions.

### Pre-commit hook

`.git-hooks/pre-commit` runs the full gate except PACKAGE:
tsc → oxlint → biome → eslint → jscpd → knip → test → build. All linters fail
on **warnings**, not just errors: oxlint `--deny-warnings`, biome
`--error-on-warnings` (read-only mode in the hook), eslint `--max-warnings 0`,
jscpd `threshold: 0`, knip exits non-zero on any finding. The hook activates
via `core.hooksPath`, wired by the `prepare` script on `bun install`
(`scripts/setup-hooks.ts`, which only sets `core.hooksPath` in this repo's own
checkout; committed `.git-hooks/` — do not bypass with `--no-verify`).
