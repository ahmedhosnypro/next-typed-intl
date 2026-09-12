# Locale parity testing

Compile-time parity (enforced when you call `createI18n` with statically typed message trees) covers the payloads the compiler can see. Message trees that are fetched at runtime, assembled from a CMS, or hand-maintained bypass that check — a locale that drifts out of sync (missing keys, wrong value kinds) only surfaces when a user hits the broken key. `next-typed-intl/testing` closes this gap with a runtime structural diff you run in your test suite.

## The API

Everything lives in one entry point:

```ts
import {
  assertLocaleParity,
  getParityMismatches,
} from "next-typed-intl/testing";
```

- `getParityMismatches(reference, candidate, options?)` — returns the diff as a non-throwing `ParityMismatch[]`.
- `assertLocaleParity(reference, candidate, options?)` — same diff, but throws a `LocaleParityError` when anything is off.

Both accept `unknown` message trees, so the shapes never need to be typed for the check to work. `reference` is the tree you treat as the source of truth (typically the default locale); `candidate` is the locale under test.

## Basic usage

```ts
import { assertLocaleParity } from "next-typed-intl/testing";
import enMessages from "./messages/en.json";
import arMessages from "./messages/ar.json";

it("ar keeps parity with en", () => {
  assertLocaleParity(enMessages, arMessages);
});
```

The check is **bidirectional** by default. Both directions of drift are reported:

- **Missing keys** — a path present in `reference` but absent from (or `undefined` in) the candidate.
- **Kind mismatches** — a path that exists in both trees but holds different kinds of values. A message leaf is either a `string` or a function (a typed plural/interpolation); if the reference has `(count: number) => string` and the candidate has a plain string, that is a mismatch.
- **Candidate-only extra keys** — keys present in the candidate but absent from the reference. These are reported with `referenceKind: "missing"`, because a candidate-only key usually means a stale translation that was removed from or renamed in the reference.

An extra subtree is reported as a single mismatch at the diverging key — not one mismatch per nested key — mirroring how the reference pass stops at the first mismatch on a path.

## Reading the diff

`assertLocaleParity` throws an `I18nError` with code `LOCALE_PARITY_MISMATCH` (see [error reference](../reference/errors.md)). The error also carries the full diff, so a test harness can report or snapshot it without re-running the comparison:

```ts
interface LocaleParityError extends I18nError {
  readonly mismatches: readonly ParityMismatch[];
}

interface ParityMismatch {
  /** Dot path, e.g. "auth.errors.invalidCredentials". */
  readonly path: string;
  /** Kind of the reference value, or "missing" if the path exists only in the candidate. */
  readonly referenceKind: string;
  /** Kind of the candidate value, or "missing" if the path is absent from the candidate. */
  readonly candidateKind: string;
}
```

The thrown message already contains a readable listing in traversal (path) order:

```
Locale parity check failed (2 mismatch(es)):
  - auth.errors.invalidCredentials: expected function, got string
  - nav.settings: expected string, got missing
```

Use `getParityMismatches` when you want the data instead of an exception — for custom assertions, snapshots, or reporting every locale at once:

```ts
import { getParityMismatches } from "next-typed-intl/testing";

const locales = ["ar", "fr", "de"] as const;

it("every locale matches the reference", () => {
  for (const locale of locales) {
    const mismatches = getParityMismatches(enMessages, messages[locale]);
    expect(mismatches).toEqual([]);
  }
});
```

Each mismatch entry describes one problem: `path` locates it, `referenceKind` says what the reference has (`"string"`, `"function"`, `"object"`, or `"missing"` for a candidate-only key), and `candidateKind` says what the candidate has (or `"missing"` when the key is absent).

## Tolerating extra keys

Some workflows intentionally let locales carry keys the reference does not declare (staged translations, locale-specific legal text). Pass `{ allowExtraKeys: true }` to tolerate candidate-only keys; missing keys and kind mismatches are still reported:

```ts
assertLocaleParity(enMessages, arMessages, { allowExtraKeys: true });
```

The option defaults to `false` (strict) and is shared by both functions via `ParityOptions`.

## Where this fits

The runtime check complements, not replaces, the compile-time parity the `createI18n` factory gives you for statically typed trees — see [Messages](./messages.md) and [Getting started](../getting-started.md). Full type signatures for both functions and the error live in the [testing reference](../reference/testing.md); the error contract is documented in [Errors](../reference/errors.md).
