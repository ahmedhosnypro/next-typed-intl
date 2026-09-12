# `next-typed-intl/react` — React reference

API reference for the client-side React surface of **next-typed-intl**: the
`I18nProvider`, the `useTranslation`/`useLocale`/`useI18n` hooks, the
`TranslationBoundary` suspense wrapper, the isolated typed-context factory
`createI18nContext`, and the locale-aware navigation set from `createNavigation`.
For setup from scratch, start with [Getting started](../getting-started.md); for
the server half see [`next-typed-intl/server`](./server.md); for the instance
factory see [`next-typed-intl`](./core.md).

The entry is marked `"use client"` and guarded with `client-only` — import it
from Client Components (or your own `"use client"` wrappers). It re-exports
`renderRichText` from `next-typed-intl/rich` so client code can render tagged
templates without a second import path.

```ts
import {
  createI18nContext,
  createNavigation,
  I18nProvider,
  renderRichText,
  TranslationBoundary,
  useI18n,
  useLocale,
  useTranslation,
} from "next-typed-intl/react";
```

Also exported (types): `I18nProviderProps`, `TypedI18nContext`,
`TypedI18nProviderProps`, `UseTranslationOptions`, `TranslationBoundaryProps`,
`TagNames`, `RichTextRenderers`, `CreateNavigationOptions`, `Navigation`,
`NavigationLinkProps`, `NavigationRouter`, `RouterNavigateOptions`,
`RouterPrefetchOptions`.

## `<I18nProvider>`

Provides the i18n instance and active locale to everything below it. Props:

```tsx
interface I18nProviderProps {
  readonly i18n: I18nBridge;
  readonly locale: string;
  readonly initialNamespaces?: Record<string, unknown>;
  readonly children: ReactNode;
}
```

- **`i18n`** — the instance whose namespace registry the components below read
  from. Functions cannot cross the Server → Client Component boundary, so do
  **not** receive this via props from a Server Component. Create the instance
  module-side and hand it inside your own `"use client"` wrapper:

  ```tsx
  // app/providers.tsx
  "use client";
  import { I18nProvider } from "next-typed-intl/react";
  import { i18n } from "@/lib/i18n";

  export function AppI18nProvider({ locale, children }) {
    return <I18nProvider i18n={i18n} locale={locale}>{children}</I18nProvider>;
  }
  ```

- **`locale`** — the active locale. Must be one of `i18n.locales`; an unknown
  locale throws `I18nError` with code `INVALID_LOCALE` at render time. This
  check is also what makes `useLocale()` sound (see below).

- **`initialNamespaces`** — pre-seeded labels keyed by namespace id: the SSR
  handoff payload. Entries are seeded into the namespace cache during render,
  before any child renders, so `useTranslation` for these namespaces resolves
  synchronously instead of suspending. Seeding is **first-wins per namespace**:
  an entry already in the cache wins, and re-rendering with the same payload is
  a no-op.

  **Serializability constraint:** values handed through this prop cross the
  RSC boundary, so they must be serializable data — no function-valued
  messages. Labels for namespaces whose messages are functions
  (pluralizers, formatted callbacks) cannot be pre-seeded this way; let them
  suspend and load through their dynamic imports instead.

  ```tsx
  // server: const cartLabels = await getNamespace(i18n, cart, locale);
  <I18nProvider i18n={i18n} locale={locale} initialNamespaces={{ cart: cartLabels }}>
    {children}
  </I18nProvider>
  ```

## `useTranslation(handle, options?)`

Read a namespace's labels for the current locale. `handle` is the typed
namespace handle returned by `i18n.defineNamespace` — the labels are typed
object properties, not string keys.

Two overloads with different return types:

```ts
// default — suspends
function useTranslation<TLabels>(
  handle: NamespaceHandle<TLabels>,
  options?: { suspense?: true }
): TLabels;

// opt-out — never suspends, never throws a loader error
function useTranslation<TLabels>(
  handle: NamespaceHandle<TLabels>,
  options: { suspense: false }
): TLabels | undefined;
```

- **Default (`{ suspense?: true }`)** — suspends (throws the loader promise)
  until the namespace chunk for the active locale has loaded. Wrap rendered
  output in a [`<TranslationBoundary>`](#translationboundary) or a plain
  `<Suspense>`. After a failed load the recorded error is thrown instead, so
  the nearest Error Boundary catches it — failures surface, they don't loop.

- **`{ suspense: false }`** — returns `TLabels | undefined`: `undefined` while
  the namespace is loading and after a failed load. Nothing starts the load on
  its own — preload the namespace (or let a suspending sibling trigger it) and
  re-render. Use this to render a degraded state without an Error Boundary:

  ```tsx
  const t = useTranslation(cart, { suspense: false });
  return <p>{t ? t.itemCount(3) : "…"}</p>;
  ```

```tsx
"use client";
import { useTranslation } from "next-typed-intl/react";
import { cart } from "@/lib/i18n";

export function CartSummary() {
  const t = useTranslation(cart); // suspends until the locale chunk loads
  return <p>{t.itemCount(3)}</p>;
}
```

See [Messages guide](../guides/messages.md) for defining namespaces and the
eager-vs-lazy delivery model.

## `useLocale()`

Current locale from the nearest `<I18nProvider>` above. Throws `I18nError`
`INVALID_CONFIG` when no provider is found.

```ts
function useLocale<TLocale extends string = string>(): TLocale;
```

By default the return type is `string`. The narrowing is sound by construction
(the provider rejects unknown locales at render time), so pass your union
explicitly when you need it narrower:

```ts
const locale = useLocale<"en" | "ar">();
```

## `useI18n()`

The i18n instance handed to the nearest `<I18nProvider>` above. Throws the same
no-provider error as `useLocale()` when none is present.

```ts
function useI18n(): I18nBridge;
```

Use it for instance-level operations that have no dedicated hook — e.g.
`i18n.isLocale(...)`, `i18n.locales`, `i18n.seedNamespace(...)` to recover a
failed load with `overwrite: true`.

## `<TranslationBoundary>`

Suspense boundary for lazily-loaded namespaces. `useTranslation` (default mode)
suspends until the namespace chunk for the active locale has loaded; wrap
translated UI in this boundary to control the fallback.

```tsx
interface TranslationBoundaryProps {
  readonly children: ReactNode; // translated UI that may suspend
  readonly fallback?: ReactNode; // rendered while suspended; defaults to nothing
}
```

```tsx
import { TranslationBoundary } from "next-typed-intl/react";

<TranslationBoundary fallback={<Spinner />}>
  <CartSummary />
</TranslationBoundary>
```

It is implemented as a Client Component (the whole `react` entry is), but that
does not restrict where it can render: a Client Component element crosses the
RSC boundary, taking `children` and `fallback` along as props, so it is
renderable from Server Components too and is the intended wrapper anywhere in
the tree. A plain `<Suspense>` remains an option when you want to wire the
boundary yourself.

## `renderRichText` (re-export)

Re-exported from `next-typed-intl/rich` for client code. Renders tagged message
templates with a compile-time-checked renderer map:

```tsx
import { renderRichText } from "next-typed-intl/react";

renderRichText("By continuing you accept the <link>terms</link>.", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
});
```

The `next-typed-intl/rich` entry carries no client-only guard — import from
there instead when you need it in Server Components. Full grammar (self-closing
tags, hyphenated names, literal `<`): [Rich text guide](../guides/rich-text.md).

## `createI18nContext()`

Create an isolated `I18nProvider` + hooks set pre-bound to your locale union,
so consumers get a fully typed `useLocale()` without repeating the generic:

```tsx
import { createI18nContext } from "next-typed-intl/react";

export const { I18nProvider, useLocale, useTranslation, useI18n } =
  createI18nContext<"en" | "ar">();

useLocale(); // "en" | "ar", not string
```

Signature and return type:

```ts
function createI18nContext<TLocale extends string>(): TypedI18nContext<TLocale>;

interface TypedI18nContext<TLocale extends string> {
  readonly I18nProvider: (props: TypedI18nProviderProps<TLocale>) => ReactElement;
  readonly useLocale: () => TLocale;
  readonly useTranslation: {
    <TLabels>(handle: NamespaceHandle<TLabels>, options?: { suspense?: true }): TLabels;
    <TLabels>(handle: NamespaceHandle<TLabels>, options: { suspense: false }): TLabels | undefined;
  };
  readonly useI18n: () => I18nBridge;
}
```

The factory-created provider accepts the same props as the top-level
`<I18nProvider>` (`i18n`, `locale`, `initialNamespaces`, `children`), with
`locale` narrowed to `TLocale`.

**Isolated context semantics:** each `createI18nContext()` call creates its own
React context, so two factories never share state and can render side by side
in one tree. Factory hooks resolve against their own factory's provider only —
do not mix factory-created hooks with the top-level hooks (or another
factory's provider) under one provider: a factory hook without its own provider
above it throws the no-provider error (`INVALID_CONFIG`). Pick one style per
tree.

## `createNavigation()`

Locale-aware navigation set for prefix-mode routing (`mode: "prefix"` on the
locale proxy): a `Link` component, `usePathname`/`useRouter` hooks, and a pure
`getPathname` builder, all sharing one prefix strategy.

```ts
function createNavigation<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options?: CreateNavigationOptions
): Navigation<TLocale>;
```

`i18n` is your instance (any `createI18n` instance satisfies the resolver
shape). Options:

```ts
interface CreateNavigationOptions {
  /**
   * Prefix strategy, matching `createLocaleProxy`'s `localePrefix`: with
   * `"as-needed"` the default locale is served unprefixed. Default: `"always"`.
   */
  readonly localePrefix?: "always" | "as-needed";
}
```

Create it once, next to your instance:

```ts
// lib/navigation.ts
import { createNavigation } from "next-typed-intl/react";
import { i18n } from "@/lib/i18n";

export const { Link, usePathname, useRouter, getPathname } =
  createNavigation(i18n, { localePrefix: "as-needed" }); // or "always" (the default)
```

### `<Link>`

`next/link`'s `Link` with the Pages-Router-only `locale` prop replaced by an
optional union-typed one. `href` is a locale-free internal pathname such as
`"/shop"`; absolute URLs carrying a scheme (`https:`, `mailto:`, `tel:`, …)
pass through unlocalized.

```tsx
interface NavigationLinkProps<TLocale extends string>
  extends Omit<ComponentProps<typeof NextLink>, "href" | "locale"> {
  readonly href: string; // locale-free internal pathname, or an absolute URL
  readonly locale?: TLocale; // target locale; defaults per the resolution order below
}
```

```tsx
"use client";
import { Link } from "@/lib/navigation";

<Link href="/shop">…</Link> // → /ar/shop under an ar context
<Link href="/shop" locale="en">…</Link> // force a locale per link
```

### `usePathname()`

`next/navigation`'s `usePathname` with the leading locale segment stripped, so
matching/highlighting logic stays locale-agnostic:

```ts
function usePathname(): string;
```

### `useRouter()`

`next/navigation`'s `useRouter` result with locale-aware `push`/`replace`/
`prefetch`: each accepts every Next option plus an extra `locale`, and the href
is routed through the factory's prefixing rules. `back`/`forward`/`refresh`
pass through untouched.

```ts
interface NavigationRouter<TLocale extends string>
  extends Omit<NextRouter, "push" | "replace" | "prefetch"> {
  push(href: string, options?: RouterNavigateOptions<TLocale>): void;
  replace(href: string, options?: RouterNavigateOptions<TLocale>): void;
  prefetch(href: string, options?: RouterPrefetchOptions<TLocale>): void;
}

type RouterNavigateOptions<TLocale extends string> = NextNavigateOptions & {
  readonly locale?: TLocale;
};
type RouterPrefetchOptions<TLocale extends string> = Partial<NextPrefetchOptions> & {
  readonly locale?: TLocale;
};
```

```tsx
router.push("/checkout"); // current locale applied
router.replace("/cart", { locale: "en" }); // override per call
router.prefetch("/shop", { locale: "en" });
```

### `getPathname()`

Pure pathname builder — the server-safe half of this factory. It reads no
request state, so it is callable from Server Components and route handlers:

```ts
getPathname({ href: "/dashboard", locale: "ar" });
```

```ts
import { redirect } from "next/navigation";
import { getPathname } from "@/lib/navigation";

redirect(getPathname({ href: "/dashboard", locale: "ar" }));
```

### Locale resolution order

The locale used to build each href (link prop, router option, or
`getPathname` argument omitted) resolves as:

1. explicit `locale` prop/option →
2. locale of the nearest `<I18nProvider>` (read via a non-throwing optional
   lookup, so rendering outside a provider never throws; a value that is not
   one of the instance's locales is ignored) →
3. `i18n.defaultLocale`.

With `localePrefix: "as-needed"`, hrefs to the default locale stay unprefixed
(matching the locale proxy's rewrite behavior); under `"always"` every locale
gets a segment.

See the [Navigation guide](../guides/navigation.md) for the full picture —
including the proxy's `localePrefix` counterpart and hreflang metadata — and
[`next-typed-intl/next`](./next.md) for the request-free
`toLocalizedPathname` when you prefer not to import from a client-guarded
entry.

## Error codes

Errors thrown by this entry are `I18nError` instances with a `.code`:

| Code | Raised when |
|---|---|
| `INVALID_LOCALE` | `<I18nProvider>` receives a `locale` outside `i18n.locales` |
| `INVALID_CONFIG` | a hook renders with no matching provider above it |

The full error table lives in the [Errors reference](./errors.md).
