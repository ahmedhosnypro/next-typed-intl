/**
 * Framework-free pathname helpers for locale-prefixed routing. Shared by the
 * Next locale proxy (`next-typed-intl/next`) and usable from a client-side
 * navigation module.
 *
 * Every pathname here is assumed to be **basePath-free** and to start with
 * `/` (e.g. Next's `nextUrl.pathname` after basePath stripping, or a
 * client-side `usePathname()` result): the locale always occupies the first
 * path segment.
 */

/**
 * Remove a locale prefix from `pathname` when the first segment matches one
 * of `locales`.
 *
 * - `"/ar/shop"` (ar configured) → `"/shop"`
 * - `"/ar"` → `"/"`
 * - `"/shop"` or a first segment not in `locales` → returned unchanged.
 *
 * Only the FIRST segment is ever considered: `"/shop/ar"` is untouched.
 */
export function stripLocalePrefix(pathname: string, locales: readonly string[]): string {
  const segments = pathname.split("/");
  const first = segments[1];
  if (first !== undefined && locales.includes(first)) {
    const rest = segments.slice(2).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}

/**
 * Return `pathname` carrying `locale` as its first segment, for building
 * locale-aware links (`<Link href={toLocalizedPathname("/shop", locale, …)}>`).
 *
 * - An existing locale segment is replaced: `"/ar/shop"` with `"en"` →
 *   `"/en/shop"`. Recognition uses `options.locales` when provided;
 *   otherwise only `[defaultLocale, locale]` are considered prefix
 *   candidates (the only locales knowable from the options alone).
 * - With `localePrefix: "as-needed"` and `locale === defaultLocale`, the
 *   pathname is returned UNPREFIXED (the default locale lives at the root).
 * - Otherwise `/{locale}` is inserted at the front; the root `"/"` becomes
 *   `"/{locale}"` (no trailing slash).
 *
 * `localePrefix` defaults to `"always"`, matching
 * `createLocaleProxy`'s default.
 */
export function toLocalizedPathname<TLocale extends string>(
  pathname: string,
  locale: TLocale,
  options: {
    /** Fallback locale; with `localePrefix: "as-needed"` it is served unprefixed. */
    readonly defaultLocale: TLocale;
    /** Prefix strategy matching `createLocaleProxy`'s `localePrefix`. Default: "always". */
    readonly localePrefix?: "always" | "as-needed";
    /**
     * All configured locales, used to recognize (and replace) an existing
     * locale segment. Defaults to `[defaultLocale, locale]` — pass the full
     * list whenever it is available.
     */
    readonly locales?: readonly string[];
  }
): string {
  const bare = stripLocalePrefix(pathname, options.locales ?? [options.defaultLocale, locale]);
  if (options.localePrefix === "as-needed" && locale === options.defaultLocale) return bare;
  return `/${locale}${bare === "/" ? "" : bare}`;
}
