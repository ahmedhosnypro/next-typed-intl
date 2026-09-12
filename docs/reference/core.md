# `next-typed-intl` (core)

The root entry is the framework-free core: instance factories, plurals, formatters, interpolation, and errors. Import everything on this page from `next-typed-intl` — no subpath. It is usable in any runtime (Node, edge, browser); the React bindings live in [`next-typed-intl/react`](./react.md) and the server helpers in [`next-typed-intl/server`](./server.md).

```ts
import {
  createI18n,
  createClientI18n,
  plural,
  createPlural,
  createFormatters,
  interpolate,
  I18nError,
} from "next-typed-intl";
```

## `createI18n`

Create a type-safe i18n instance with an eager messages map.

```ts
function createI18n<
  const TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
  TMessagesMap extends Record<TLocales[number], unknown>,
>(config: I18nConfig<TLocales, TDefault, TMessagesMap>): I18nInstance<TLocales[number], TMessagesMap[TDefault]>;
```

The default locale's `messages` entry is the schema source; every other locale is checked against it at compile time (see [`messages`](../guides/messages.md)). The default locale may be any entry of `locales`, not necessarily the first. Config is validated eagerly at setup — JS consumers get runtime errors where TS users get compile errors.

```ts
// lib/i18n.ts
import { createI18n } from "next-typed-intl";
import { en } from "@/locales/en";
import { ar } from "@/locales/ar";

export const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en", // any listed locale; its entry defines the schema
  messages: { en, ar }, // `ar` checked against `en`'s shape
});
```

### Config fields (`I18nConfig`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `locales` | `TLocales` (non-empty tuple of string BCP-47 tags) | — required | Frozen at creation; entries must be valid BCP-47 tags (`"en-US"`, not `"en_US"`), else `INVALID_CONFIG`. Duplicates (case-insensitive) are rejected. |
| `defaultLocale` | `TDefault` (one of `locales`) | — required | Fallback for every unknown locale request. Must appear in `locales`. |
| `messages` | `TMessagesMap & LocaleParity<...>` | — required | Keyed by locale. Compile-time parity: every non-default entry must structurally match the default's entry. |
| `canonicalizeLocales` | `boolean` | `true` | Canonicalize every declared tag (and `defaultLocale`) via `Intl.getCanonicalLocales` at setup — `"en-us"` → `"en-US"`, `"EN"` → `"en"` — so `i18n.locales`, cookie values, URL segments, and message-map keys all use canonical form. Pass `false` to keep the declared strings verbatim. |

`I18nConfig` extends `ClientI18nConfig` (which carries `locales`, `defaultLocale`, and `canonicalizeLocales`). A string enum drives the config too — enum member literal types flow through `locales`, `defaultLocale`, and `defineNamespace`'s loader keys:

```ts
enum Locale { En = "en", Ar = "ar" }

const i18n = createI18n({
  locales: [Locale.En, Locale.Ar],
  defaultLocale: Locale.En,
  messages: { [Locale.En]: en, [Locale.Ar]: ar },
});
```

`as const` is never needed — `createI18n` uses a `const` type parameter. Numeric enums are rejected (`INVALID_CONFIG`). With canonicalization on (the default), declare the canonical value in the enum itself: `En = "en-US"`, not `En = "en-us"`.

## `createClientI18n`

Registry-only variant for the client bundle: the same namespace machinery (lazy loaders, suspense cache, SSR seeding) without the eager messages map, so nothing but the chunks a component actually renders ships to the client.

```ts
function createClientI18n<
  const TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
>(config: ClientI18nConfig<TLocales, TDefault>): ClientI18n<TLocales[number]>;
```

`ClientI18nConfig` has the same `locales` / `defaultLocale` / `canonicalizeLocales` fields and validation as `createI18n`, minus `messages`. The result is `ClientI18n` — the full instance minus `getMessages`. Pair it with a server `createI18n` instance that registers the same namespaces (share a registrar function); the two interoperate by namespace id. See [`examples/full-app`](../../examples/full-app) and the [zero-eager-client setup](../guides/messages.md).

## `I18nInstance`

All instance methods. Both factories return objects satisfying this shape (`ClientI18n` omits `getMessages`).

| Method | Signature | Notes |
|---|---|---|
| `locales` | `readonly TLocale[]` | All supported locales, in declared order. Frozen at creation. |
| `defaultLocale` | `TLocale` | Fallback whenever a requested locale is unknown. |
| `isLocale` | `(value: string) => value is TLocale` | Strict check: only an exact match against the configured `locales` is `true`. |
| `resolveLocale` | `(value?: string \| null) => TLocale` | Resolve any incoming string: exact match → case-insensitive match (configured casing wins) → parent-tag walk (`"de-CH-x"` → `"de-CH"` → `"de"`) → `defaultLocale`. Underscores are tolerated (`"en_US"` → `"en-US"`). |
| `getMessages` | `(locale?: string) => TMessages` | Synchronously read the eager messages tree (default locale when omitted). Throws `MISSING_MESSAGES` if absent. `createClientI18n` instances have no `getMessages`. |
| `defineNamespace` | `<TLabels>(id: string, loaders: Record<TLocale, NamespaceLoader<TLabels>>) => NamespaceHandle<TLabels>` | Register a lazy per-locale namespace; every configured locale must provide a loader, else `MISSING_LOADER`. Throws `INVALID_NAMESPACE_ID` for an empty id, `DUPLICATE_NAMESPACE` for a repeated id. |
| `loadNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string) => Promise<TLabels>` | Start loading and return the promise; concurrent callers share one dynamic import. |
| `readNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string) => TLabels` | Suspense read: returns labels if loaded, throws the in-flight loading promise while loading. After a rejected load it throws the recorded error (not a promise) so error boundaries catch it; the failed entry is kept, never silently retried. |
| `peekNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string) => TLabels \| undefined` | Cache lookup with no side effects: labels if loaded, `undefined` while loading or after a failure. Never starts a load; unknown handles still throw `UNKNOWN_NAMESPACE`. Safe for the `suspense: false` path. |
| `preloadNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string) => void` | Fire-and-forget load that warms the cache before a suspense read. |
| `preloadAllLocales` | `<TLabels>(handle: NamespaceHandle<TLabels>) => void` | Warm the cache for every configured locale at once. |
| `seedNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale: string, labels: TLabels, options?: SeedNamespaceOptions) => void` | Insert already-available labels into the cache (SSR handoff). First write wins; `overwrite: true` replaces an existing entry and also recovers a failed one. |
| `retryNamespace` | `<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string) => void` | Drop a failed entry's recorded error and start a fresh load (fire-and-forget) — the recovery path for an error boundary's retry (e.g. Next 16's `error.tsx` `retry()`). A still-in-flight entry is left alone. |
| `seedNamespaceById` | `(id: string, locale: string, labels: unknown) => void` | Insert labels keyed by the raw namespace id, bypassing the registry (the namespace need not be defined yet) — for provider-level `initialNamespaces` seeding where no handle is available. First write wins. |

### Namespace types

```ts
/** A per-namespace lazy loader. Must resolve to the labels object directly —
 * use `.then((m) => m.auth)` when your locale modules do not default-export. */
type NamespaceLoader<TLabels> = () => Promise<TLabels>;

/** Opaque handle returned by `i18n.defineNamespace`. Carries the labels type
 * for inference. */
interface NamespaceHandle<TLabels> {
  readonly id: string;
  readonly __labels?: TLabels; // phantom, never present at runtime
}

/** Options for `i18n.seedNamespace`. */
interface SeedNamespaceOptions {
  /** Replace an existing cached entry; defaults to first-wins. */
  readonly overwrite?: boolean;
}
```

Failed loads surface rather than loop: `readNamespace` re-throws the recorded error into the nearest error boundary; recover explicitly with `seedNamespace(handle, locale, labels, { overwrite: true })` or `retryNamespace`. See [`messages`](../guides/messages.md) for the full pattern.

### Helper-authoring types

Types for code that handles instances without knowing the concrete locales:

| Type | Shape |
|---|---|
| `AnyI18n` | `I18nInstance<string, unknown>` — any instance. |
| `ClientI18n<TLocale>` | The instance minus `getMessages`. |
| `I18nBridge` | The subset the React provider and hooks use: `locales`, `defaultLocale`, `isLocale`, `resolveLocale`, `readNamespace`, `peekNamespace`, `seedNamespace`, `seedNamespaceById`. |
| `LocaleResolverShape<TLocale>` | `locales` / `defaultLocale` / `isLocale` / `resolveLocale` — satisfied by both factory results. |
| `NamespaceHost` | `resolveLocale` + `loadNamespace` — the subset needed to resolve lazy namespaces. |
| `LocaleParity<TLocales, TDefault, TMessagesMap>` | The compile-time parity type behind `I18nConfig["messages"]` (see [`testing`](./testing.md) for the runtime counterpart). |

## Plurals

CLDR plural selection via `Intl.PluralRules` — no ICU parser. See [`plurals`](../guides/plurals.md).

```ts
function plural(locale: string, count: number, forms: PluralForms, options?: PluralOptions): string;

function createPlural(
  locale: string,
  options?: PluralOptions
): (count: number, forms: PluralForms) => string;
```

```ts
import { createPlural } from "next-typed-intl";

const plural = createPlural("en"); // bind once per locale file

const items = (count: number) => plural(count, { one: "1 item", other: `${count} items` });
```

- `plural` selects a form for `count` under `locale`'s rules. An exact `=<count>` form (`"=0": "No items"`) wins first, then the CLDR category form, falling back to `forms.other`.
- `createPlural` binds the locale (and options) once; call sites write `plural(count, forms)`.
- `PluralForms` requires `other`; the remaining CLDR categories and ICU-style `=<number>` keys are optional — a missing category the locale actually selects is a compile-time error, not a runtime `undefined`.

```ts
/** CLDR plural categories as reported by `Intl.PluralRules`. */
type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralForms = { other: string } &
  Partial<Record<Exclude<PluralCategory, "other">, string>> & { [K in `=${number}`]?: string };

/** Forwarded to `Intl.PluralRules` — includes `type` plus ES2023 rounding options. */
type PluralOptions = Intl.PluralRulesOptions;
```

Pass `{ type: "ordinal" }` for ordinal categories (1st, 2nd, 3rd…).

## Formatters

Thin, cached `Intl` wrappers — formatter instances are memoized per locale + options. See [`formatting`](../guides/formatting.md).

```ts
function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string;
function formatCurrency(locale: string, value: number, currency: string, options?: Intl.NumberFormatOptions): string;
function formatDateTime(locale: string, date: Date | number, options?: Intl.DateTimeFormatOptions): string;
function formatDateRange(
  locale: string,
  start: Date | number,
  end: Date | number,
  options?: Intl.DateTimeFormatOptions
): string;
function formatRelativeTime(
  locale: string,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions
): string;
function formatList(locale: string, items: readonly string[], options?: Intl.ListFormatOptions): string;

function createFormatters(locale: string): Formatters;
```

`createFormatters` binds all six to one locale — `fmt.number(…)`,
`fmt.currency(…)`, `fmt.dateTime(…)`, `fmt.dateRange(…)`,
`fmt.relative(…)`, `fmt.list(…)` — with the same arguments minus the locale.
Usage examples live in [Formatting](../guides/formatting.md).

`Formatters` mirrors the unbound functions with the locale dropped: `number`, `currency`, `dateTime`, `dateRange`, `relative`, `list`. `dateTime`/`dateRange` accept both `Date` and epoch-millis `number`.

## `interpolate`

Replace `{name}` placeholders in a template with values. No ICU parser — placeholders are typed.

```ts
function interpolate<T extends string>(
  template: T,
  values: Record<PlaceholderNames<T>, string | number> & Record<string, string | number>,
  options?: InterpolateOptions
): string;

interface InterpolateOptions {
  /** Format `number` values with `formatNumber` for this locale instead of `String(value)`. */
  readonly locale?: string;
}
```

```ts
import { interpolate } from "next-typed-intl";

interpolate("Welcome back, {name} — {count} new messages", { name: "Sara", count: 5 });
interpolate("{count} items", { count: 1234 }, { locale: "ar" }); // Arabic digits via formatNumber
```

Grammar and typing rules:

- Placeholder names match `\w` (`[A-Za-z0-9_]+`). A brace name outside that grammar (e.g. `{first-name}`) is literal text.
- `{{` and `}}` escape to literal `{` / `}` — so `{{name}}` renders as the literal text `{name}` and is never substituted. Ported catalogs: in i18next/Handlebars `{{name}}` is the placeholder; here write `{name}`.
- `PlaceholderNames<T>` extracts the names at compile time — `PlaceholderNames<"Hi {name}, you have {count}">` is `"name" | "count"` — so a missing value is a type error before it can run.
- Strict at runtime: every placeholder must have a matching key, else `I18nError` `MISSING_PLACEHOLDER` listing the missing names.
- Substituted values are inserted verbatim — a value containing braces is never re-scanned.

See [`interpolation`](../guides/interpolation.md).

## `DEFAULT_LOCALE_COOKIE`

```ts
const DEFAULT_LOCALE_COOKIE = "NEXT_LOCALE";
```

Default cookie name for locale persistence, used by the locale proxy in [`next-typed-intl/next`](./next.md).

## Errors

All runtime errors are `I18nError` instances with a stable machine-readable `.code`.

```ts
class I18nError extends Error {
  readonly code: I18nErrorCode; // stable across releases
  constructor(code: I18nErrorCode, message: string);
}
```

The message is prefixed `next-typed-intl [CODE]: <human message>`; the same code is on `.code` for programmatic handling:

```ts
import { I18nError } from "next-typed-intl";

try {
  i18n.getMessages();
} catch (error) {
  if (error instanceof I18nError && error.code === "MISSING_MESSAGES") {
    // ...
  }
}
```

`I18nErrorCode` union:

| Code | Raised when |
|---|---|
| `INVALID_CONFIG` | Factory config is structurally invalid (no locales, duplicates, unknown default, invalid tags). |
| `MISSING_MESSAGES` | Messages for the resolved locale are absent or not an object. |
| `INVALID_NAMESPACE_ID` | `defineNamespace` was called with an empty/non-string id. |
| `DUPLICATE_NAMESPACE` | A namespace id was registered twice on the same instance. |
| `UNKNOWN_NAMESPACE` | A namespace handle unknown to the instance was read or loaded. |
| `MISSING_LOADER` | A namespace loader is missing for a locale. |
| `MISSING_PLACEHOLDER` | One or more `{placeholders}` in a template had no matching value. |
| `INVALID_LOCALE` | A locale value is not one of the configured locales. |
| `MALFORMED_RICH_TEXT` | A rich-text string could not be parsed. |
| `LOCALE_PARITY_MISMATCH` | A testing-time locale parity check found mismatches. |

Codes raised outside this entry are documented in [`errors`](./errors.md).

## Not exported from this entry

The framework-free routing helpers in `src/core/routing.ts` — `stripLocalePrefix` and `toLocalizedPathname` — are re-exported from [`next-typed-intl/next`](./next.md) (together with `createLocaleProxy`, `resolveRequestLocale`, `detectAcceptLanguage`, `getLocaleFromPathname`, and `LOCALE_HEADER`), not from the root entry. React hooks and components are in [`next-typed-intl/react`](./react.md); request-scoped server helpers are in [`next-typed-intl/server`](./server.md).
