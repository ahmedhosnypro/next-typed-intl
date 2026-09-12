# Messages and namespaces

`next-typed-intl` ships messages in two complementary forms: an **eager messages tree** for the server — one plain object per locale, read synchronously — and **lazy namespaces** for Client Components, loaded per locale through dynamic imports with a suspense-aware cache. Both live on the same `createI18n` instance, and both are compile-time typed against your schema.

This guide covers the schema, locale files, instance creation, canonicalization, and the full namespace lifecycle. For pluralization helpers see [Pluralization](./plurals.md), for number/date/list formatting see [Formatting](./formatting.md) and [Interpolation](./interpolation.md), and for routing strategies see [Routing](./routing.md).

## The messages schema

Define one interface (or one tree) describing every key. Plain properties are strings; dynamic content is a typed function — `(count: number) => string` — so pluralization and interpolation need no ICU parser and no codegen:

```ts
// locales/types.ts
export interface Messages {
  home: { title: string; items: (count: number) => string };
}
```

Implement every locale against that interface — each locale file exports an object typed `Messages`, with `createPlural` bound once per file to produce a function covering that locale's CLDR plural categories, all typed. The full `en`/`ar` pair is in [Getting started](../getting-started.md); the plural mechanics (categories, ordinals, explicit counts) are in [Pluralization](./plurals.md).

## Creating the instance

`createI18n` takes a config of `locales`, `defaultLocale`, and `messages` — the complete setup snippet is in [Getting started](../getting-started.md), and the full config type is in the [Core reference](../reference/core.md). The `defaultLocale`'s `messages` entry is the schema source: every other locale is checked against it structurally at compile time. A locale missing a key — or adding an extra one — is a compile error, with no annotations required. You can verify parity at test time too with `assertLocaleParity` from `next-typed-intl/testing` ([Testing](./testing.md)).

`defaultLocale` may be any entry of `locales`, not necessarily the first.

### Config validation

The config is validated eagerly when `createI18n` runs (JavaScript consumers get no compile-time checks). The following throw `I18nError` with the listed codes:

- `INVALID_CONFIG` — `locales` is empty or not an array; an entry is not a string; a tag is not valid BCP-47 (use hyphens: `"en-US"`, not `"en_US"`); duplicate locales compared case-insensitively; `defaultLocale` is not a string or not one of `locales`.
- `MISSING_MESSAGES` — no messages object for the `defaultLocale`.

`locales` is frozen at creation, so later external mutation of the array you passed cannot desync the derived lookup maps.

### Locale canonicalization

At setup, every declared locale tag and the `defaultLocale` are canonicalized via `Intl.getCanonicalLocales` — `"en-us"` becomes `"en-US"`, `"EN"` becomes `"en"` — so `i18n.locales`, `defaultLocale`, cookie values, URL segments, and message-map keys all use canonical BCP 47 form:

```ts
export const i18n = createI18n({
  locales: ["en-us", "ar"] as const, // canonicalized to ["en-US", "ar"]
  defaultLocale: "en-us", // → "en-US"
  messages: { "en-US": enUsMessages, ar: arMessages }, // canonical keys
});
```

Canonicalization is **on by default**. Pass `canonicalizeLocales: false` to keep your declared strings verbatim (the pre-canonicalization behavior).

Two things to know when it is on:

- **Lenient resolution is unchanged.** Old cookies like `"AR"` or `"en_US"`, and other non-canonical inputs, still resolve onto a configured locale through `resolveLocale`'s case-insensitive and parent-tag fallbacks.
- **Exact URL segments are canonical.** In prefix mode a `/en-us/about` URL now **redirects** to `/en-US/about` — a breaking change if you served non-canonical segments before. Message-map keys must be canonical too: a key like `"en-us"` is a compile-time error against the canonicalized config, enforced by the parity types.

### Typed locales with an enum

Instead of inline string literals you can drive the config from a TypeScript string enum — the members' literal types flow through, so `locales`, `defaultLocale`, `resolveLocale`, and `defineNamespace`'s loader keys stay typed as enum members:

```ts
enum Locale {
  En = "en",
  Ar = "ar",
}

export const i18n = createI18n({
  locales: [Locale.En, Locale.Ar],
  defaultLocale: Locale.En,
  messages: { [Locale.En]: en, [Locale.Ar]: ar },
});
```

Both forms are interchangeable (`as const` isn't needed either way — `createI18n` uses a const type parameter), and the compile-time parity check applies to enum-keyed `messages` exactly as it does to string literals. Numeric enums are not locales: a config whose entries are not strings is rejected at startup with `INVALID_CONFIG`, just like an invalid tag.

Enum member **values** are canonicalized like any other tag: with `canonicalizeLocales` on (the default), declare the canonical value in the enum itself — `En = "en-US"`, not `En = "en-us"` — since message-map keys and URL segments use the canonical form.

## Namespaces: lazy messages for the client

The eager tree is fine for server rendering, but importing it into a Client Component ships every string of every locale to the browser. Namespaces solve this: register a lazy loader per locale, and only the chunks a component actually renders are fetched.

### `defineNamespace`

```ts
i18n.defineNamespace<TLabels>(id: string, loaders: Record<TLocale, NamespaceLoader<TLabels>>): NamespaceHandle<TLabels>
```

- `id` — a non-empty string, unique per instance. Empty ids throw `INVALID_NAMESPACE_ID`, duplicates throw `DUPLICATE_NAMESPACE`.
- `loaders` — one `NamespaceLoader<TLabels>` (`() => Promise<TLabels>`) per configured locale. A missing loader for any configured locale throws `MISSING_LOADER`.
- Returns a `NamespaceHandle<TLabels>` — an opaque `{ id }` carrying the labels type for inference. It is a plain string key (not a unique symbol) so label inference survives `.d.ts` bundling across subpath exports.

```ts
// lib/i18n.ts (continued)
import type { CartLabels } from "@/locales/types";

export const cart = i18n.defineNamespace<CartLabels>("cart", {
  en: () => import("@/locales/en/cart").then((m) => m.cart),
  ar: () => import("@/locales/ar/cart").then((m) => m.cart),
});
```

Loaders must resolve to the labels object directly — use `.then((m) => m.cart)` when your locale modules do not default-export.

### Reading a namespace in a component

`useTranslation(handle)` from `next-typed-intl/react` suspends until the namespace chunk for the active locale loads:

```tsx
export function CartSummary() {
  const t = useTranslation(cart); // suspends while the chunk loads
  return <p>{t.itemCount(3)}</p>;
}
```

Wrap lazily-loaded UI in a `TranslationBoundary` (Client Components only — the react entry is marked `"use client"`; in a Server Component use a plain `<Suspense>`). The full wiring — component, boundary, and the provider wrapper — is in [Getting started](../getting-started.md).

### The namespace lifecycle

Every instance (eager or client-only) exposes the same namespace machinery:

| Member | Signature (simplified) | Behavior |
|---|---|---|
| `loadNamespace` | `(handle, locale?) => Promise<TLabels>` | Starts loading and returns the promise; concurrent callers deduplicate into one dynamic import. |
| `preloadNamespace` | `(handle, locale?) => void` | Fire-and-forget load that warms the cache before a suspense read. |
| `preloadAllLocales` | `(handle) => void` | Warms the cache for every configured locale at once. |
| `readNamespace` | `(handle, locale?) => TLabels` | Suspense-style read: returns labels if loaded, throws the loading promise while in flight, throws the recorded error after a failure. |
| `peekNamespace` | `(handle, locale?) => TLabels \| undefined` | Cache lookup with no side effects: labels if loaded, `undefined` while loading or after a failure. Never starts a load. |
| `retryNamespace` | `(handle, locale?) => void` | Drops a failed entry and starts a fresh load — the recovery path for an error boundary's retry. |
| `seedNamespace` | `(handle, locale, labels, options?) => void` | Inserts already-available labels into the cache (SSR handoff). |
| `seedNamespaceById` | `(id, locale, labels) => void` | Same, keyed by raw namespace id, bypassing the registry — the namespace need not be defined yet. |

`locale` is optional on reads and preloads and defaults to `defaultLocale`; it is resolved through `resolveLocale` (exact match → case-insensitive → parent-tag walk → default), so `"AR"` and `"en_US"` still hit `ar` and `en-US`. A handle not created by the instance throws `UNKNOWN_NAMESPACE`.

`seedNamespace` accepts `SeedNamespaceOptions`:

```ts
i18n.seedNamespace(
  handle: NamespaceHandle<TLabels>,
  locale: string,
  labels: TLabels,
  options?: SeedNamespaceOptions // { overwrite?: boolean }
): void;
```

Seeding is **first-wins** per namespace: an entry already in the cache is not overwritten, and re-seeding with the same payload is a no-op. Pass `{ overwrite: true }` to replace an existing entry.

## SSR handoff with `initialNamespaces`

Server Components read the eager tree directly (`getMessages`, or `getNamespace` for a namespace slice from `next-typed-intl/server` — see the [Server reference](../reference/server.md)). To avoid a client-side waterfall for labels you already loaded on the server, pass them to `I18nProvider` keyed by namespace id; the provider seeds them before any child renders, so `useTranslation` for those namespaces resolves synchronously instead of suspending:

```tsx
"use client";
import { I18nProvider } from "next-typed-intl/react";
import { i18n } from "@/lib/i18n";

export function AppI18nProvider({ locale, children }) {
  return (
    <I18nProvider i18n={i18n} locale={locale} initialNamespaces={{ cart: cartLabels }}>
      {children}
    </I18nProvider>
  );
}
```

```ts
// on the server, before rendering:
const cartLabels = await getNamespace(i18n, cart, locale);
```

The provider lives in your code as a tiny `"use client"` wrapper because the instance holds functions — and functions cannot cross the Server→Client Component boundary as props. Import the instance module directly inside the wrapper; do not receive it via props from an RSC.

Constraints and semantics:

- `initialNamespaces` is `Record<string, unknown>` — keyed by namespace id, not by handle. Seeding goes through `seedNamespaceById`, which bypasses the registry, so the namespace does not even need to be defined on that instance. First write wins.
- The payload must be **serializable** (data only): function-valued messages cannot cross the Server→Client boundary.
- Seeding happens during render, before any child reads a namespace, so re-rendering with the same payload is a no-op.

## Failed loads surface, they don't loop

If a namespace chunk fails to load, the failure is **retained**, not evicted: the rejected entry stays in the cache and `useTranslation` (default suspense mode) throws the recorded error toward the nearest Error Boundary instead of silently retrying forever (a 404ing chunk would otherwise loop). Concurrent reads of the same failure never surface as unhandled-rejection warnings.

Recover explicitly, either by re-seeding with the labels you have:

```ts
i18n.seedNamespace(cart, locale, fallbackLabels, { overwrite: true });
```

or by letting the error boundary retry, which drops the failed entry and starts a fresh load:

```ts
i18n.retryNamespace(cart, locale);
```

## Opting out of suspense

`useTranslation(handle, { suspense: false })` returns `TLabels | undefined` — `undefined` while the namespace is loading and after a failed load — so you can render a degraded state without an Error Boundary. The non-suspending path never starts a load on its own: preload the namespace (or let a suspending sibling trigger the load) and re-render.

```tsx
const t = useTranslation(cart, { suspense: false });
return <p>{t ? t.itemCount(3) : "…"}</p>;
```

## Zero-eager-client setup

When the messages tree grows, keep it entirely server-only. `createClientI18n` creates a registry-only variant: the same namespace machinery (lazy loaders, suspense cache, SSR seeding) without the eager messages map and without `getMessages`, so nothing but the chunks a component actually renders ships to the client:

```ts
// lib/i18n-client.ts
import { createClientI18n } from "next-typed-intl";

export const i18n = createClientI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
});
```

`createClientI18n` takes the same config shape as `createI18n` minus `messages` (validation, canonicalization, and error codes included). The returned instance exposes every namespace member listed above — `defineNamespace`, `loadNamespace`, `readNamespace`, `seedNamespace`, and the rest — and interoperates with the server instance by namespace id. Register the same namespace ids on both instances (share one registrar function that calls `defineNamespace` on each), then use `seedNamespaceById`/`initialNamespaces` for the server→client handoff. See `examples/full-app` for a complete setup.
