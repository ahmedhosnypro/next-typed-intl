import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE_COOKIE, LOCALE_HEADER } from "../core/constants";
import { detectAcceptLanguage } from "../core/negotiate";
import type { LocaleResolverShape } from "../index";

export { stripLocalePrefix, toLocalizedPathname } from "../core/routing";

/**
 * Request header the locale proxy stamps with the resolved locale on every
 * pass-through (`NextResponse.next`) and on default-locale rewrites. Server
 * Components read it back via `getRequestLocale`, keeping the first render's
 * locale in sync with the URL in prefix mode (where the cookie may still
 * hold a stale value).
 */
export { DEFAULT_LOCALE_COOKIE, detectAcceptLanguage, LOCALE_HEADER };

/** Default `Max-Age` (seconds) for the persisted locale cookie: one year. */
const DEFAULT_COOKIE_MAX_AGE = 31_536_000;

export interface LocaleDetectionOptions {
  /** Cookie name consulted first. Default: "NEXT_LOCALE". */
  readonly cookieName?: string;
  /** Fall back to the Accept-Language header when the cookie is absent. Default: true. */
  readonly detectAcceptLanguage?: boolean;
  /**
   * `Max-Age` (seconds) for the persisted locale cookie.
   * Default: 31_536_000 (one year). Pass `0` for a session cookie.
   */
  readonly cookieMaxAge?: number;
  /**
   * Mark the locale cookie `Secure`. Default: true on https requests, false
   * on plain http (so localhost development keeps working). Resolved per
   * request from the request URL's protocol.
   */
  readonly cookieSecure?: boolean;
}

/**
 * Extract a valid locale prefix from a pathname ("/ar/dashboard" → "ar").
 * The pathname must be basePath-free: callers serving under a `basePath`
 * must strip it first (the proxy does this internally).
 */
export function getLocaleFromPathname<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  pathname: string
): TLocale | undefined {
  const segment = pathname.split("/")[1] ?? "";
  return i18n.isLocale(segment) ? segment : undefined;
}

/**
 * Synchronous locale resolution for the locale proxy (cookie first, then
 * Accept-Language, then the instance default). This entry never imports
 * `next/headers`, so it runs in Next 16 `proxy.ts` (nodejs runtime) and Next
 * 15 `middleware.ts` alike.
 */
export function resolveRequestLocale<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  request: NextRequest,
  options: LocaleDetectionOptions = {}
): TLocale {
  const cookieName = options.cookieName ?? DEFAULT_LOCALE_COOKIE;
  const cookieValue = request.cookies.get(cookieName)?.value;
  // The cookie is user-agent state: resolve it leniently ("EN" → "en") and
  // bail to the instance default when it matches nothing.
  if (cookieValue) return i18n.resolveLocale(cookieValue);
  if (options.detectAcceptLanguage ?? true) {
    return detectAcceptLanguage(i18n, request.headers.get("accept-language"));
  }
  return i18n.defaultLocale;
}

export interface LocaleProxyOptions extends LocaleDetectionOptions {
  /**
   * - "cookie" (default): stateless locale — resolve and persist the cookie,
   *   URLs keep no locale segment.
   * - "prefix": locale as the first path segment (`/ar/...`); requests
   *   lacking a prefix are redirected to the resolved locale.
   */
  readonly mode?: "cookie" | "prefix";
  /**
   * Prefix strategy for `mode: "prefix"`:
   * - "always" (default): every URL carries the locale segment; unprefixed
   *   requests are redirected to `/{locale}{pathname}`.
   * - "as-needed": the default locale is served unprefixed. Unprefixed
   *   requests resolving to the default locale are **internally rewritten**
   *   to `/{defaultLocale}{pathname}` — the browser URL stays unprefixed
   *   while the app is served from its `app/[locale]` segment. Requests
   *   prefixed with the default locale are redirected to the unprefixed
   *   equivalent; non-default locales behave like "always".
   */
  readonly localePrefix?: "always" | "as-needed";
}

/**
 * Build a locale proxy handler. Usage:
 *
 * ```ts
 * // proxy.ts (Next 16) or middleware.ts (Next 15)
 * import { i18n } from "@/lib/i18n";
 * import { createLocaleProxy } from "next-typed-intl/next";
 * export default createLocaleProxy(i18n, { mode: "prefix" });
 * export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
 * ```
 *
 * Excluding `api` (and `_vercel`) matters especially in prefix mode:
 * otherwise API requests to unprefixed `/api/...` paths would be answered
 * with a locale redirect instead of being served.
 */
/** Pass through, stamping the resolved locale onto the forwarded request headers. */
function nextWithLocale<TLocale extends string>(request: NextRequest, locale: TLocale): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function createLocaleProxy<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options: LocaleProxyOptions = {}
): (request: NextRequest) => NextResponse {
  const cookieName = options.cookieName ?? DEFAULT_LOCALE_COOKIE;
  // cookieMaxAge 0 means "session cookie": omit Max-Age entirely (Max-Age=0 would delete immediately).
  const maxAge = options.cookieMaxAge === 0 ? undefined : (options.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE);
  // Cookie options are built per request: the `Secure` default depends on the
  // request protocol ("https:" → true, plain http → false for localhost dev).
  const cookieOptionsFor = (request: NextRequest) =>
    ({
      path: "/",
      sameSite: "lax",
      maxAge,
      secure: options.cookieSecure ?? request.nextUrl.protocol === "https:",
    }) as const;

  /** Persist the cookie on pass-through/rewrite responses only when it changes (cache-friendly). */
  const syncCookie = (request: NextRequest, response: NextResponse, locale: TLocale): void => {
    if (request.cookies.get(cookieName)?.value !== locale) {
      response.cookies.set(cookieName, locale, cookieOptionsFor(request));
    }
  };

  if (options.mode === "prefix") {
    const localePrefix = options.localePrefix ?? "always";
    return (request: NextRequest) => {
      // NextURL normally strips basePath from pathname and re-adds it when a
      // cloned URL is formatted; guard against callers/URLs that still carry it.
      const { basePath } = request.nextUrl;
      const rawPathname = request.nextUrl.pathname;
      const pathname =
        basePath && rawPathname.startsWith(basePath) ? rawPathname.slice(basePath.length) || "/" : rawPathname;
      const existing = getLocaleFromPathname(i18n, pathname);
      if (existing) {
        if (localePrefix === "as-needed" && existing === i18n.defaultLocale) {
          request.nextUrl.pathname = pathname.slice(`/${existing}`.length) || "/";
          const response = NextResponse.redirect(request.nextUrl);
          response.cookies.set(cookieName, existing, cookieOptionsFor(request));
          return response;
        }
        const response = nextWithLocale(request, existing);
        syncCookie(request, response, existing);
        return response;
      }
      const locale = resolveRequestLocale(i18n, request, options);
      if (localePrefix === "as-needed" && locale === i18n.defaultLocale) {
        // Internal rewrite: the browser URL stays unprefixed while the app is
        // served from its `/{defaultLocale}` segment.
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(LOCALE_HEADER, locale);
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
        const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
        syncCookie(request, response, locale);
        return response;
      }
      request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      const response = NextResponse.redirect(request.nextUrl);
      response.cookies.set(cookieName, locale, cookieOptionsFor(request));
      return response;
    };
  }

  return (request: NextRequest) => {
    const locale = resolveRequestLocale(i18n, request, options);
    const response = nextWithLocale(request, locale);
    syncCookie(request, response, locale);
    return response;
  };
}

/**
 * Next 15-style alias for {@link createLocaleProxy}, kept for backward
 * compatibility with codebases on the `middleware` file convention (Next 16
 * renamed it to `proxy` and deprecated-but-kept `middleware` the same way).
 *
 * @deprecated Use {@link createLocaleProxy} instead.
 */
export const createLocaleMiddleware = createLocaleProxy;

/**
 * Next 15-style alias for {@link LocaleProxyOptions}.
 *
 * @deprecated Use {@link LocaleProxyOptions} instead.
 */
export type LocaleMiddlewareOptions = LocaleProxyOptions;
