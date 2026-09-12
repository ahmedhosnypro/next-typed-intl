# next-typed-intl Docs

next-typed-intl is a compile-time type-safe i18n library for Next.js: keys are typed object properties (`t.nav.home`), pluralization and interpolation are typed functions, and locale parity is enforced at compile time.

## Getting started

- [Getting started](./getting-started.md) — installation, setup, and your first `createI18n` instance.

## Guides

- [Messages schema & namespaces](./guides/messages.md) — structuring messages and lazy per-namespace loading.
- [Locale routing](./guides/routing.md) — prefix-based locale routing with `createLocaleProxy`.
- [Static rendering](./guides/static-rendering.md) — keeping prefix routes statically prerenderable with `setRequestLocale`.
- [Plurals](./guides/plurals.md) — CLDR plural categories without an ICU parser.
- [Formatting](./guides/formatting.md) — `Intl`-backed number, currency, date, and list formatting.
- [Interpolation](./guides/interpolation.md) — typed `{placeholders}` in message templates.
- [Rich text](./guides/rich-text.md) — rendering formatted strings with React elements, RSC-safe.
- [Navigation](./guides/navigation.md) — localized `Link`/`useRouter` helpers plus SEO metadata and hreflang.
- [Testing](./guides/testing.md) — runtime locale parity checks with `assertLocaleParity`.

## API Reference

- [`next-typed-intl`](./reference/core.md) — the core entry: `createI18n`, `createClientI18n`, plurals, formatters, interpolation.
- [`next-typed-intl/react`](./reference/react.md) — `I18nProvider`, `useTranslation`, `TranslationBoundary`, navigation hooks.
- [`next-typed-intl/server`](./reference/server.md) — `getMessages`, `getNamespace`, `getRequestLocale`, `setRequestLocale`.
- [`next-typed-intl/next`](./reference/next.md) — `createLocaleProxy`, request locale resolution, pathname helpers.
- [`next-typed-intl/rich`](./reference/rich.md) — `renderRichText` and rich-text types.
- [`next-typed-intl/testing`](./reference/testing.md) — parity assertions for your test suite.
- [Errors](./reference/errors.md) — `I18nError` and the full list of machine-readable `I18nErrorCode` values.

## More

- [Migration](./migration.md) — coming from next-intl or react-i18next.
- [Examples](../examples/) — runnable Next.js apps: [`basic-app`](../examples/basic-app) and [`full-app`](../examples/full-app).
