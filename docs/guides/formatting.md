# Formatting

`next-typed-intl` ships thin wrappers over the native `Intl` formatters —
`Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, and
`Intl.ListFormat` — for numbers, currency, dates, date ranges, relative times,
and lists. There is no custom formatting engine: every option is the native
`Intl` option, passed straight through, and every helper is bound to a locale
either explicitly or once via `createFormatters`. All of them are exported from
the root entry:

```ts
import {
  createFormatters,
  formatNumber,
  formatCurrency,
  formatDateTime,
  formatDateRange,
  formatRelativeTime,
  formatList,
} from "next-typed-intl";
```

## Bound helpers: `createFormatters`

`createFormatters(locale)` returns a `Formatters` object with every helper
pre-bound to one locale — the shape you typically hang off a message context or
pass down with the current request locale:

```ts
import { createFormatters } from "next-typed-intl";

const fmt = createFormatters("ar");

fmt.number(1234567.89);
fmt.currency(49.99, "USD");
fmt.dateTime(new Date(), { dateStyle: "long" });
fmt.dateRange(new Date("2026-01-10"), new Date("2026-01-15"), { dateStyle: "medium" });
fmt.relative(-3, "day");
fmt.list(["تفاح", "برتقال", "موز"]);
```

The bound `Formatters` object — one method per helper, with the locale
already fixed:

| Method | Signature |
|---|---|
| `number` | `(value: number, options?: Intl.NumberFormatOptions) => string` |
| `currency` | `(value: number, currency: string, options?: Intl.NumberFormatOptions) => string` |
| `dateTime` | `(date: Date \| number, options?: Intl.DateTimeFormatOptions) => string` |
| `dateRange` | `(start: Date \| number, end: Date \| number, options?: Intl.DateTimeFormatOptions) => string` |
| `relative` | `(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string` |
| `list` | `(items: readonly string[], options?: Intl.ListFormatOptions) => string` |

Note that the relative-time method is named `relative` on the bound object.

## Unbound helpers

Each helper is also exported standalone with the locale as the first argument —
useful when the locale is only known at call time (per-request rendering, a
locale switcher, etc.). The arguments after `locale` mirror the bound methods
exactly:

| Function | Signature |
|---|---|
| `formatNumber` | `(locale: string, value: number, options?: Intl.NumberFormatOptions) => string` |
| `formatCurrency` | `(locale: string, value: number, currency: string, options?: Intl.NumberFormatOptions) => string` |
| `formatDateTime` | `(locale: string, date: Date \| number, options?: Intl.DateTimeFormatOptions) => string` |
| `formatDateRange` | `(locale: string, start: Date \| number, end: Date \| number, options?: Intl.DateTimeFormatOptions) => string` |
| `formatRelativeTime` | `(locale: string, value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string` |
| `formatList` | `(locale: string, items: readonly string[], options?: Intl.ListFormatOptions) => string` |

```ts
formatNumber("de-DE", 1234567.89);            // "1.234.567,89"
formatCurrency("en-US", 49.99, "USD");        // "$49.99"
formatDateTime("en-GB", Date.now(), { dateStyle: "long" });
formatDateRange("en-US", 1768012800000, 1768358400000, { dateStyle: "medium" });
formatRelativeTime("en", -3, "day");          // "3 days ago"
formatList("en", ["a", "b", "c"]);            // "a, b, and c"
```

## Behavior details

- **`Date` or epoch millis.** `formatDateTime` and `formatDateRange` accept
  either a `Date` or a `number` of milliseconds since the epoch — both are
  passed directly to the underlying `Intl` formatter.

- **Native options, pass-through.** The `options` argument is the corresponding
  native option bag (`Intl.NumberFormatOptions`, `Intl.DateTimeFormatOptions`,
  `Intl.RelativeTimeFormatOptions`, `Intl.ListFormatOptions`). Nothing is
  filtered or renamed, so anything MDN documents for the underlying formatter
  works here. `formatCurrency` merges your options with `style: "currency"`
  and the given `currency` code, so you can still set `currencyDisplay`,
  `minimumFractionDigits`, and friends on top.

- **Relative time requires a unit.** `formatRelativeTime` takes an
  `Intl.RelativeTimeFormatUnit` (`"day"`, `"hour"`, `"minute"`, …) plus a
  signed value: negative for the past (`-3, "day"` → "3 days ago"), positive
  for the future (`2, "hour"` → "in 2 hours"). Pluralization of the unit word
  is handled by `Intl.RelativeTimeFormat` per locale.

- **Locale-aware digits.** Number and date rendering (digit shapes, grouping
  separators, calendar, month names, ordering) comes from the runtime's ICU
  data. A runtime whose ICU data defaults `ar` to Latin digits will render
  `1,234,567.89` where another renders `١٬٢٣٤٬٥٦٧٫٨٩`. Force a specific
  numbering system explicitly when it matters:

  ```ts
  fmt.number(1234567.89, { numberingSystem: "arab" });
  ```

- **Instances are cached.** Formatter instances are memoized per
  `(locale, options)` pair internally, so calling helpers in a render loop does
  not re-construct `Intl` formatters.

## Where formatting fits

- `interpolate(template, values, { locale })` formats **number** placeholder
  values via `formatNumber` under the hood — see [Interpolation](./interpolation.md).
- Pluralized messages (`plural`, `createPlural`) handle count-based text
  selection and compose naturally with these helpers — see
  [Pluralization](./plurals.md).
- For the full `Formatters` type and every other core export, see the
  [Core API reference](../reference/core.md).
- New to the library? Start with [Getting started](../getting-started.md).
