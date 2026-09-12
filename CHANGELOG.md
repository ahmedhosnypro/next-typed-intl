# Changelog

All notable changes to next-typed-intl are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1-alpha.0] - 2026-09-13

### Added

- `createI18n` factory: typed message trees with per-locale compile-time parity against the default locale, `Intl.getCanonicalLocales` canonicalization of locale tags (`canonicalizeLocales`, default `true`), and dual delivery — eager synchronous messages for the server, lazy per-namespace dynamic imports for the client.
- Typed pluralization via `plural`/`createPlural` (native TypeScript, no ICU parser, no codegen) and typed interpolation via `interpolate` with inferred placeholder names.
- Intl formatters: `formatNumber`, `formatCurrency`, `formatDateTime`, `formatDateRange`, `formatRelativeTime`, `formatList`, plus `createFormatters`.
- React bindings (`next-typed-intl/react`): `I18nProvider` with `initialNamespaces`, `useTranslation` with optional suspense, `useLocale`, `useI18n`, `TranslationBoundary`, `createI18nContext`, `createNavigation` (`Link`/`usePathname`/`useRouter`/`getPathname`).
- Rich text (`next-typed-intl/rich`): RSC-safe `renderRichText` with typed tags.
- Server entry (`next-typed-intl/server`): `getMessages`, `getNamespace`, `getRequestLocale`, `setRequestLocale` — request-scoped locale override that keeps prefix routes statically prerenderable.
- Proxy-safe middleware entry (`next-typed-intl/next`): `createLocaleProxy` (alias `createLocaleMiddleware`), `resolveRequestLocale`, `detectAcceptLanguage`, `getLocaleFromPathname`, `stripLocalePrefix`, `toLocalizedPathname`.
- Testing utilities (`next-typed-intl/testing`): `assertLocaleParity`, `getParityMismatches` with `ParityOptions.allowExtraKeys`.
- ESM-only package with six subpath exports, full `d.ts` bundles, verified by publint + attw (`esm-only` profile).