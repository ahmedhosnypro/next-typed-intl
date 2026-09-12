# Testing API reference

`next-typed-intl/testing` checks message trees at runtime. The compiler already prevents locale drift for statically-typed `createI18n` calls, but dynamically fetched or hand-maintained payloads are invisible to it — these helpers diff them structurally and fail loudly when locales fall out of sync.

```ts
import { assertLocaleParity, getParityMismatches } from "next-typed-intl/testing";
```

The entry exports `assertLocaleParity`, `getParityMismatches`, `ParityOptions`, `ParityMismatch`, and `LocaleParityError`. For how to wire these into a test suite, see [the testing guide](../guides/testing.md).

## `assertLocaleParity(reference, candidate, options?)`

Throws when `candidate` does not structurally match `reference`. Intended use inside a consumer test suite:

```ts
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

it("ar keeps parity with en", () => {
  assertLocaleParity(enMessages, arMessages);
});
```

- **Bidirectional by default**: both missing keys in the candidate *and* candidate-only extra keys are reported. Drift in either direction fails.
- **Signature**: `assertLocaleParity(reference: unknown, candidate: unknown, options?: ParityOptions): void` — both trees are typed `unknown`, so real-world payloads (JSON imports, `fetch` results) need no casting.
- On failure it throws an [`I18nError`](./errors.md) with code `LOCALE_PARITY_MISMATCH` whose message lists every mismatch as `- <path>: expected <referenceKind>, got <candidateKind>`. The thrown value also carries the full diff as `.mismatches` (a `LocaleParityError`), so a test harness can report or snapshot it without re-running the diff:

```ts
try {
  assertLocaleParity(enMessages, arMessages);
} catch (error) {
  const mismatches = (error as LocaleParityError).mismatches;
  // [{ path: "nav.home", referenceKind: "string", candidateKind: "missing" }, ...]
}
```

## `getParityMismatches(reference, candidate, options?)`

The non-throwing counterpart: returns the structural diff as an array instead of throwing.

- **Signature**: `getParityMismatches(reference: unknown, candidate: unknown, options?: ParityOptions): ParityMismatch[]`
- An empty array means the trees match (under the given options). Use it for custom assertions or reporting:

```ts
const mismatches = getParityMismatches(enMessages, arMessages);
expect(mismatches).toEqual([]);
```

## `ParityMismatch`

Each entry describes one diverging path:

| Property | Type | Description |
| --- | --- | --- |
| `path` | `string` | Dot path of the diverging key, e.g. `"auth.errors.invalidCredentials"`. |
| `referenceKind` | `string` | Kind of the reference value, or `"missing"` if the path exists only in the candidate (extra key). |
| `candidateKind` | `string` | Kind of the candidate value, or `"missing"` if the path is absent from the candidate. |

Kinds are `"string"` for plain message leaves, `"function"` for typed plurals/formatters, and `"object"` for nested trees. Two rules worth knowing when reading a diff:

- **Kind mismatches count as drift**: a key that is a string in the reference but a function (or object) in the candidate is reported, not silently accepted.
- **Extra subtrees are one mismatch**: a candidate-only key that itself is a nested object is reported once at the diverging key, not once per descendant leaf.

## `ParityOptions`

Options for both `assertLocaleParity` and `getParityMismatches`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `allowExtraKeys` | `boolean` (optional) | `false` | When `true`, keys present in the candidate but absent from the reference are tolerated. When `false` (strict), extra keys are reported with `referenceKind: "missing"` — a candidate-only key usually means a stale translation that was removed from or renamed in the reference. |

```ts
assertLocaleParity(enMessages, arMessages, { allowExtraKeys: true });
```

Missing keys and kind mismatches are always reported, regardless of this option.

## Error type

`LocaleParityError` (an `I18nError` with code `LOCALE_PARITY_MISMATCH`) carries `mismatches: readonly ParityMismatch[]` — every mismatch that failed the check, in traversal (path) order. See [the errors reference](./errors.md) for the full error catalog.
