# Server API reference (`next-typed-intl/server`)

`next-typed-intl/server` is the server-side entry point: it gives Server Components, layouts, and route handlers eager access to the messages tree, lazy namespace resolution, and a request-scoped locale with a defined precedence chain. The entry is guarded by `server-only` and imports `next/headers`, so importing it from client code fails at build time — client rendering resolves locales and namespaces through `useTranslation` + suspense instead (see [the react reference](./react.md) and [guides/messages.md](../guides/messages.md)).

All four exports require an i18n instance — the object returned by `createI18n` (see [getting-started.md](../getting-started.md)):

```ts
import {
  getMessages,
  getNamespace,
  getRequestLocale,
  setRequestLocale,
} from "next-typed-intl/server";
```

## `getMessages(i18n, locale?)`

```ts
async function getMessages<TLocale extends string, TMessages>(
  i18n: I18nInstance<TLocale, TMessages>,
  locale?: TLocale
): Promise<TMessages>
```

Eager access to the full messages tree — for Server Components, route handlers, and anywhere per-call dynamic imports would be wasteful. The whole graph is bundled server-side; never import this entry from client code (guarded by `server-only`).

```tsx
import { getMessages, getRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getRequestLocale(i18n);
  const t = await getMessages(i18n, locale);
  return <h1>{t.home.title}</h1>;
}
```

When `locale` is omitted, the request locale is resolved via [`getRequestLocale`](#getrequestlocalei18n-options). When it is passed, it must be one of the instance's configured locales (typed to your union, so valid call sites compile and invalid ones do not).

## `getNamespace(i18n, handle, locale?)`

```ts
async function getNamespace<TLabels, TLocale extends string = string>(
  i18n: NamespaceHost & LocaleResolverShape<TLocale>,
  handle: NamespaceHandle<TLabels>,
  locale?: TLocale
): Promise<TLabels>
```

Resolve a lazy namespace defined with `defineNamespace` — e.g. `await` it inside a Server Component to use its labels in server-rendered output:

```tsx
import { getNamespace } from "next-typed-intl/server";
import { i18n, cart } from "@/lib/i18n";

export default async function CartPage() {
  const cartLabels = await getNamespace(i18n, cart);
  return <p>{cartLabels.itemCount(3)}</p>;
}
```

Labels contain functions, so they cannot be handed to Client Components as props; client rendering resolves namespaces through `useTranslation` + suspense instead (see [guides/messages.md](../guides/messages.md)).

When `locale` is omitted, the request locale is resolved via [`getRequestLocale`](#getrequestlocalei18n-options). As with `getMessages`, an explicit locale short-circuits resolution entirely.

## `getRequestLocale(i18n, options?)`

```ts
interface RequestLocaleOptions {
  /** Cookie name consulted before Accept-Language. Default: "NEXT_LOCALE". */
  readonly cookieName?: string;
  /** Fall back to the Accept-Language header when no stamped header or cookie matches. Default: true. */
  readonly detectAcceptLanguage?: boolean;
}

async function getRequestLocale<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options?: RequestLocaleOptions
): Promise<TLocale>
```

Request-scoped locale for Server Components, layouts, and route handlers. The precedence chain:

1. The [`setRequestLocale`](#setrequestlocalei18n-locale) override, when set — returned without touching `headers()`/`cookies()`, so statically prerendered routes keep working (see [guides/static-rendering.md](../guides/static-rendering.md)).
2. The `LOCALE_HEADER` request header (`"x-next-typed-intl-locale"`), stamped by [`createLocaleProxy`](./next.md). This is URL-truth in prefix mode, so the first render matches the visible locale — correct even on prefix redirects.
3. The locale cookie (name: `options.cookieName`, default `DEFAULT_LOCALE_COOKIE = "NEXT_LOCALE"`). Cookie values resolve leniently through `resolveLocale`, so `"AR"`, `"en_US"`, or a child tag like `"de-CH"` still map onto a configured locale.
4. `Accept-Language` negotiation, when `options.detectAcceptLanguage` is `true` (default).
5. The instance's `defaultLocale`.

The signal reads (`headers()`/`cookies()`) are the request-scoped IO and re-run per call; the pure resolution over those primitives is memoized with React's `cache`, so repeated calls with identical signals within a request reuse the result.

```ts
const locale = await getRequestLocale(i18n);
const messages = await getMessages(i18n, locale);
```

## `setRequestLocale(i18n, locale)`

```ts
function setRequestLocale<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  locale: TLocale
): void
```

Pin the request locale explicitly, bypassing header/cookie/Accept-Language resolution. Typically called from `app/[locale]/layout.tsx` together with `generateStaticParams`:

```tsx
// app/[locale]/layout.tsx
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params; // string — narrow it before use
  if (!i18n.isLocale(locale)) notFound();
  setRequestLocale(i18n, locale);
  const t = await getMessages(i18n, locale);
  // ...
}
```

### Why this keeps routes statically prerenderable

`headers()`/`cookies()` are Next's dynamic APIs, so any component awaiting `getRequestLocale` on the signal path opts the whole route into dynamic rendering. With an override set, `getRequestLocale` — and the locale-omitted forms of `getMessages`/`getNamespace` anywhere below the layout — return the pinned locale **without** touching `headers()`/`cookies()`, so the route prerenders statically. The full recipe, including the Next.js 16 `next/root-params` variant, is in [guides/static-rendering.md](../guides/static-rendering.md).

### `INVALID_LOCALE`

Passing a locale outside the instance's configured `locales` throws `I18nError` with code `INVALID_LOCALE`, naming the received value and the configured locales. This guards untyped call sites (the raw `params` segment above); typed callers already get a compile error. That is why the `i18n.isLocale(locale)` guard + `notFound()` in the recipe is the right way to narrow `params` before calling `setRequestLocale`.

The override lives in a React `cache` slot, so each request render gets a fresh object and locales never leak across requests.
