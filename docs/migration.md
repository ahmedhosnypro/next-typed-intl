# Coming from next-intl / react-i18next

`next-typed-intl` replaces the string-keyed translator call (`t("cart.itemCount")`)
with typed object properties (`t.itemCount`), and replaces ICU message
catalogs with plain typed TypeScript functions. If you already run
next-intl or react-i18next, the routing concepts map over almost one-to-one —
the mental-model differences are in how messages are defined, typed, and read.
This page maps the vocabulary, walks through the mechanics that behave
differently, and states plainly what this library deliberately does not do.

## Vocabulary map

For next-intl users:

| next-intl | next-typed-intl |
|---|---|
| `localeDetection` | `detectAcceptLanguage` |
| `localePrefix: "never"` | `mode: "cookie"` |
| `localePrefix: "always" / "as-needed"` | `mode: "prefix"` + `localePrefix: "always" / "as-needed"` |
| `routing.domains` | not supported — domain-based routing is a documented non-goal |
| `getRequestConfig` / ICU JSON catalogs | typed `messages` objects + `defineNamespace` loaders |

For react-i18next users the mapping is looser: `useTranslation(ns)` keeps its
name but takes a typed namespace handle instead of a string namespace, and
`initReactI18next`-style providers become `I18nProvider` with a `createI18n`
instance.

## The mental model is familiar, the mechanics differ

### `t` is a labels object, not a callable

`useTranslation(handle)` returns the typed labels object. You write
`t.itemCount(3)` — accessing real properties with autocomplete — not
`t("cart.itemCount")` with a string key. A renamed key errors at every usage
site; a typo never compiles. The same shape holds on the server:
`getMessages` returns the messages tree.

```ts
// next-intl / i18next: t("cart.itemCount", { count: 3 })
// next-typed-intl:
const t = useTranslation(cart);
t.itemCount(3); // typed as (count: number) => string
```

### Client reads suspend by default

`useTranslation` suspends until the namespace chunk loads. Three ways to deal
with it:

1. Wrap lazily-loaded UI in a plain `<Suspense>` or `TranslationBoundary`
   (Client Components only — the `/react` entry is marked `"use client"`).
2. Seed SSR payloads with the provider's `initialNamespaces` prop, so
   `useTranslation` resolves synchronously for those namespaces.
3. Opt out per hook: `useTranslation(handle, { suspense: false })` returns
   `TLabels | undefined` — `undefined` while the namespace is loading and
   after a failed load — so you can render a degraded state without an Error
   Boundary.

```tsx
<TranslationBoundary fallback={<Spinner />}>
  <CartSummary />
</TranslationBoundary>
```

### No ICU strings — typed functions and objects

Plurals, interpolation, and rich text are typed TypeScript selected per call,
not parsed from message strings at runtime:

- `plural(count, { one: "...", other: "..." })` — CLDR category keys via
  `Intl.PluralRules`, `other` mandatory, ICU-style `"=N"` explicit counts
  supported. Messages that need logic are plain functions in your schema.
- `interpolate(template, values)` — `{name}` placeholders typed by
  `PlaceholderNames<T>`, so a missing value is a compile error before the
  runtime `MISSING_PLACEHOLDER` throw can ever happen.
- `renderRichText(template, renderers)` — the renderer map is compile-checked
  against the tags the template uses.

```ts
// next-intl: "items": "{count, plural, =0 {No items} one {# item} other {# items}}"
// next-typed-intl:
items: (count) => plural(count, { one: "1 item", other: `${count} items` }),
```

### `{{name}}` means the opposite of what you're used to

In i18next and Handlebars, `{{name}}` is the placeholder. Here single braces
are the placeholder and `{{name}}` escapes to the *literal text* `{name}`.
Port catalogs by converting `{{name}}` → `{name}` — and mind any other escape
scheme your old catalogs used (`\{name\}`, HTML-escaped variants), since
filtered/escaped placeholder variants do not exist here.

### Locale resolution has a fallback chain

`resolveLocale` on the instance matches exactly, then case-insensitively
(the configured casing wins), then walks parent tags (`de-CH` → `de`), then
falls back to the default locale — rather than exact-match-or-nothing. It also
tolerates POSIX-style underscores (`en_US` → `en-US`), so old cookies and
stored preferences keep resolving onto a configured locale. `isLocale(value)`
is the strict counterpart: only an exact match against the configured
`locales` returns `true`.

### Surface area

Domain-based routing and TMS catalog round-trips are deliberately out of
scope. If either is a hard requirement for your app, that is the one place a
JSON-catalog library is the better fit.

## No JSON catalog round-trip: the translator workflow is a PR

Messages are TypeScript objects and functions, not JSON catalogs — that is
what makes keys autocomplete and pluralizers type-checked. The flip side is
deliberate: there is no round-trip with TMS platforms (Crowdin, Lokalise,
LingoHub, …) that expect JSON/XLIFF/ICU files, and no automated
extract-translate-merge pipeline. The translator workflow here is a pull
request against typed `locales/*.ts` files: translators edit the locale
module, the compile-time parity check rejects any locale that is missing a
key or exports a stale one, and `next-typed-intl/testing`'s
`assertLocaleParity` covers dynamically fetched payloads the compiler cannot
see. If your workflow requires translators editing catalogs in a hosted TMS,
a JSON-based library is the better fit.

## Where to go next

- [Getting started](./getting-started.md) — install, define the schema,
  implement locales, create the instance.
- [Routing](./guides/routing.md) — cookie vs prefix mode, the locale proxy,
  and the prefix-strategy equivalents of `localePrefix`.
