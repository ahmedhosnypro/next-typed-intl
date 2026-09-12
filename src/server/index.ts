import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE_COOKIE, LOCALE_HEADER } from "../core/constants";
import { I18nError } from "../core/errors";
import { detectAcceptLanguage } from "../core/negotiate";
import type { I18nInstance, LocaleResolverShape, NamespaceHandle, NamespaceHost } from "../core/types";

/** Options for {@link getRequestLocale}. */
export interface RequestLocaleOptions {
  /** Cookie name consulted before Accept-Language. Default: "NEXT_LOCALE". */
  readonly cookieName?: string;
  /** Fall back to the Accept-Language header when no stamped header or cookie matches. Default: true. */
  readonly detectAcceptLanguage?: boolean;
}

/**
 * Pure locale resolution from primitive request signals, memoized with
 * React's `cache`. Keying on primitives (not on the request stores) keeps
 * memoization semantics correct outside a React request context: identical
 * signals safely share a result, different signals always re-resolve.
 */
const resolveFromSignals = cache(
  <TLocale extends string>(
    i18n: LocaleResolverShape<TLocale>,
    stamped: string | null,
    cookie: string | null,
    acceptLanguage: string | null,
    detectEnabled: boolean
  ): TLocale => {
    if (stamped && i18n.isLocale(stamped)) return stamped;
    // The cookie is user-agent state, not attacker-controlled per request
    // like the stamped header: resolve it leniently ("AR" → "ar").
    if (cookie) return i18n.resolveLocale(cookie);
    if (detectEnabled) return detectAcceptLanguage(i18n, acceptLanguage);
    return i18n.defaultLocale;
  }
);

/**
 * Request-scoped locale override written by {@link setRequestLocale}. The
 * React `cache` makes the slot request-scoped on the server: each request
 * render gets a fresh object, so locales never leak across requests.
 */
const requestLocaleOverride = cache((): { locale?: string } => ({}));

/**
 * Pin the request locale explicitly, bypassing header/cookie/Accept-Language
 * resolution. Typically called from `app/[locale]/layout.tsx` together with
 * `generateStaticParams`, which keeps the route statically prerenderable:
 * `headers()`/`cookies()` are Next's dynamic APIs, so any component awaiting
 * {@link getRequestLocale} on the signal path would otherwise opt the whole
 * route into dynamic rendering. With an override set, `getRequestLocale`
 * returns it WITHOUT touching `headers()`/`cookies()`.
 *
 * ```ts
 * export function generateStaticParams() {
 *   return i18n.locales.map((locale) => ({ locale }));
 * }
 *
 * export default async function LocaleLayout({ children, params }) {
 *   const { locale } = await params;
 *   setRequestLocale(i18n, locale);
 *   return children;
 * }
 * ```
 *
 * @throws {I18nError} `INVALID_LOCALE` when `locale` is not one of the
 *   instance's configured locales (guards untyped call sites; typed callers
 *   already get a compile error).
 */
export function setRequestLocale<TLocale extends string>(i18n: LocaleResolverShape<TLocale>, locale: TLocale): void {
  if (!i18n.isLocale(locale)) {
    throw new I18nError(
      "INVALID_LOCALE",
      `setRequestLocale received "${locale}", which is not one of the configured locales: ${i18n.locales.join(", ")}.`
    );
  }
  requestLocaleOverride().locale = locale;
}

/**
 * Eager access to the full messages tree — for Server Components, route
 * handlers, and anywhere per-call dynamic imports would be wasteful. The
 * whole graph is bundled server-side; never import this entry from client
 * code (guarded by `server-only`).
 *
 * When `locale` is omitted, the request locale is resolved via
 * {@link getRequestLocale}.
 */
export async function getMessages<TLocale extends string, TMessages>(
  i18n: I18nInstance<TLocale, TMessages>,
  locale?: TLocale
): Promise<TMessages> {
  return i18n.getMessages(locale ?? (await getRequestLocale(i18n)));
}

/**
 * Resolve a lazy namespace on the server — e.g. `await` it inside a Server
 * Component to use its labels in server-rendered output. (Labels contain
 * functions, so they cannot be handed to Client Components as props; client
 * rendering resolves namespaces through `useTranslation` + suspense instead.)
 *
 * When `locale` is omitted, the request locale is resolved via
 * {@link getRequestLocale}.
 */
export async function getNamespace<TLabels, TLocale extends string = string>(
  i18n: NamespaceHost & LocaleResolverShape<TLocale>,
  handle: NamespaceHandle<TLabels>,
  locale?: TLocale
): Promise<TLabels> {
  return i18n.loadNamespace(handle, locale ?? (await getRequestLocale(i18n)));
}

/**
 * Request-scoped locale for Server Components, layouts, and route handlers.
 * Precedence: the {@link setRequestLocale} override (when set — returned
 * without touching `headers()`/`cookies()`, so statically prerendered routes
 * keep working), then the `LOCALE_HEADER` request header stamped by
 * `createLocaleProxy` (URL-truth in prefix mode, so the first render
 * matches the visible locale), then the locale cookie (resolved leniently),
 * then Accept-Language, then the instance default.
 *
 * The signal reads (`headers()`/`cookies()`) are the request-scoped IO and
 * re-run per call; the pure resolution over those primitives is memoized
 * with React's `cache`, so repeated calls with identical signals within a
 * request reuse the result.
 *
 * ```ts
 * const locale = await getRequestLocale(i18n);
 * const messages = await getMessages(i18n, locale);
 * ```
 */
export async function getRequestLocale<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options: RequestLocaleOptions = {}
): Promise<TLocale> {
  const override = requestLocaleOverride().locale;
  if (override !== undefined) return override as TLocale;
  const headerStore = await headers();
  const cookieStore = await cookies();
  return resolveFromSignals(
    i18n,
    headerStore.get(LOCALE_HEADER),
    cookieStore.get(options.cookieName ?? DEFAULT_LOCALE_COOKIE)?.value ?? null,
    headerStore.get("accept-language"),
    options.detectAcceptLanguage ?? true
  );
}
