# Pluralization

`next-typed-intl` pluralizes with the CLDR rules your runtime already ships: `plural(locale, count, forms)` selects a category via `Intl.PluralRules` and returns the matching form. There is no ICU parser and no codegen — plural forms are plain object properties, so a missing required form is a compile-time type error, not a runtime `undefined`.

## Import

Both helpers are exported from the root entry (full signatures in [the core reference](../reference/core.md)):

```ts
import { plural, createPlural } from "next-typed-intl";
```

## `plural` and `createPlural`

`plural(locale, count, forms, options?)` resolves the category for `count` under `locale`'s rules and returns the matching form. Bind the locale once per file with `createPlural(locale, options?)`, which returns a `(count, forms) => string` function — message modules then write `plural(count, forms)` without repeating the locale on every call site.

```ts
import { createPlural } from "next-typed-intl";

const plural = createPlural("ar");

const items = (count: number) =>
  plural(count, {
    zero: "لا عناصر",
    one: "عنصر واحد",
    two: "عنصران",
    few: `${count} عناصر`,
    many: `${count} عنصراً`,
    other: `${count} عنصراً`,
  });
```

Arabic selects all six CLDR cardinal categories (`zero`, `one`, `two`, `few`, `many`, `other`), so its forms object can cover every one. English selects only `one` and `other`, so its forms object needs only the categories `en` actually uses:

```ts
const plural = createPlural("en");

const items = (count: number) =>
  plural(count, { one: "1 item", other: `${count} items` });
```

Per-locale category sets come straight from `Intl.PluralRules` — the library does not hardcode a table. If you are unsure which categories a locale selects, check [`Intl.PluralRules`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules) for that locale in your runtime.

## The forms object

The forms object is typed as `PluralForms`:

- `other` is **required**. Omitting it is a type error. It is the fallback whenever the selected category has no form defined, so the function never returns `undefined`.
- Every other category (`zero`, `one`, `two`, `few`, `many`) is optional. A category the locale never selects can simply be left out, and a category with no form falls back to `other` at runtime.
- Unknown keys outside the six categories and the `=N` pattern are rejected by excess property checking, so typos like `othr` or `fwe` fail to compile.

## Explicit counts

An ICU-style `"=N"` key matches that exact count before any category is consulted, so special cases don't fight the CLDR rules:

```ts
const plural = createPlural("en");

const items = (count: number) =>
  plural(count, {
    "=0": "No items",
    "=1": "Exactly one item",
    one: "1 item",
    other: `${count} items`,
  });
```

Resolution order inside `plural`:

1. An exact `=<count>` form, if defined, wins immediately.
2. Otherwise the CLDR category for `count` under `locale` (and `options`, if given).
3. Otherwise `other`.

## Ordinals

Pass `{ type: "ordinal" }` to `plural` or `createPlural` for `Intl.PluralRules` ordinal categories (1st, 2nd, 3rd…):

```ts
const ordinal = createPlural("en", { type: "ordinal" });

const place = (n: number) =>
  ordinal(n, { one: `${n}st`, two: `${n}nd`, few: `${n}rd`, other: `${n}th` });
```

`PluralOptions` is `Intl.PluralRulesOptions`, so `type` and the ES2023 rounding options (`roundingMode`, `roundingIncrement`, `trailingZeroDisplay`, minimum/maximum fraction and significant digits) are all accepted and forwarded. Rules instances are cached per locale-plus-options, so repeated calls reuse the same `Intl.PluralRules`.

## Hand-written functions as messages

Because messages are typed object properties, any message value can be a hand-written function like `items` above — `(count: number) => string` is a perfectly valid message. The default locale's messages tree is the schema source (see [Messages](./messages.md)): every other locale's entry must match its shape, so a plural function present in the default locale must exist in every locale, and the compiler enforces it. Pass the bound `plural` around or define it per locale file; see [Getting started](../getting-started.md) for the messages-file layout and [Migration](../migration.md) if you are moving from ICU-based libraries.
