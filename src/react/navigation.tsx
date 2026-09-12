"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { type ComponentProps, type ReactElement, useMemo } from "react";
import { stripLocalePrefix, toLocalizedPathname } from "../core/routing";
import type { LocaleResolverShape } from "../core/types";
import { useOptionalLocale } from "./context";

type NextRouter = ReturnType<typeof useNextRouter>;
type NextNavigateOptions = NonNullable<Parameters<NextRouter["push"]>[1]>;
type NextPrefetchOptions = NonNullable<Parameters<NextRouter["prefetch"]>[1]>;

/** Options for {@link createNavigation}. */
export interface CreateNavigationOptions {
  /**
   * Prefix strategy, matching `createLocaleProxy`'s `localePrefix`: with
   * `"as-needed"` the default locale is served unprefixed. Default: `"always"`.
   */
  readonly localePrefix?: "always" | "as-needed";
}

/** Options accepted by the `push`/`replace` methods of {@link NavigationRouter}. */
export type RouterNavigateOptions<TLocale extends string> = NextNavigateOptions & {
  /** Locale to build the target href with; defaults to the context locale, then the instance's default locale. */
  readonly locale?: TLocale;
};

/**
 * Options accepted by the `prefetch` method of {@link NavigationRouter}.
 * `PrefetchOptions` declares `kind` required, but Next's runtime defaults it
 * to `PrefetchKind.AUTO` (and the enum is not part of the public exports), so
 * all options are optional here, matching the runtime contract.
 */
export type RouterPrefetchOptions<TLocale extends string> = Partial<NextPrefetchOptions> & {
  /** Locale to build the target href with; defaults to the context locale, then the instance's default locale. */
  readonly locale?: TLocale;
};

/**
 * next/navigation's `useRouter` result with locale-aware
 * `push`/`replace`/`prefetch`: each accepts an extra `locale` option and
 * routes the href through the factory's prefixing rules. `back`/`forward`/
 * `refresh` (and any future members) pass through untouched.
 */
export type NavigationRouter<TLocale extends string> = Omit<NextRouter, "push" | "replace" | "prefetch"> & {
  /** Push a locale-aware href — accepts every `NavigateOptions` plus `locale`. */
  push(href: string, options?: RouterNavigateOptions<TLocale>): void;
  /** Replace with a locale-aware href — accepts every `NavigateOptions` plus `locale`. */
  replace(href: string, options?: RouterNavigateOptions<TLocale>): void;
  /** Prefetch a locale-aware href — accepts every `PrefetchOptions` plus `locale`. */
  prefetch(href: string, options?: RouterPrefetchOptions<TLocale>): void;
};

/**
 * Props of the {@link Navigation} `Link`: everything next/link's `Link`
 * accepts (the Pages-Router-only `locale` prop is replaced), plus an optional
 * union-typed `locale`. `href` is a locale-free internal pathname such as
 * `"/shop"`; absolute URLs carrying a scheme (`https:`, `mailto:`, …) pass
 * through unlocalized.
 */
export type NavigationLinkProps<TLocale extends string> = Omit<ComponentProps<typeof NextLink>, "href" | "locale"> & {
  /** Locale-free internal pathname, or an absolute URL passed through unchanged. */
  readonly href: string;
  /** Target locale; defaults to the context locale, then the instance's default locale. */
  readonly locale?: TLocale;
};

/** The locale-aware navigation set returned by {@link createNavigation}. */
export interface Navigation<TLocale extends string> {
  /**
   * next/link `Link` that prefixes `href` with the effective locale
   * (explicit `locale` prop → `I18nProvider` context locale → instance's
   * default locale). Under `localePrefix: "as-needed"` the default locale
   * href stays unprefixed; external URLs pass through unchanged.
   */
  readonly Link: (props: NavigationLinkProps<TLocale>) => ReactElement;
  /** next/navigation's `usePathname` with the leading locale segment stripped. */
  readonly usePathname: () => string;
  /** next/navigation's `useRouter` with locale-aware push/replace/prefetch. */
  readonly useRouter: () => NavigationRouter<TLocale>;
  /**
   * Pure pathname builder — the server-safe half of this factory. Use it from
   * Server Components and route handlers, e.g. with Next 16's `redirect`:
   *
   * ```ts
   * import { redirect } from "next/navigation";
   * redirect(getPathname({ href: "/dashboard", locale: "ar" }));
   * ```
   */
  readonly getPathname: (args: { readonly href: string; readonly locale: TLocale }) => string;
}

/** Leading URL scheme (`https:`, `mailto:`, `tel:`, …) marking an external href. */
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Create a next-intl-style locale-aware navigation set for prefix-mode
 * routing: a `Link` component, `usePathname`/`useRouter` hooks and a pure
 * `getPathname` builder, all sharing one prefix strategy.
 *
 * The `locale` of links and navigations resolves as: explicit `locale`
 * argument → locale of the nearest `I18nProvider` (read via
 * {@link useOptionalLocale}, so rendering outside a provider never throws) →
 * `i18n.defaultLocale`.
 *
 * ```tsx
 * // i18n/navigation.ts
 * import { createNavigation } from "next-typed-intl/react";
 * import { i18n } from "@/lib/i18n";
 * export const { Link, usePathname, useRouter, getPathname } = createNavigation(i18n, {
 *   localePrefix: "as-needed",
 * });
 * ```
 */
export function createNavigation<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options?: CreateNavigationOptions
): Navigation<TLocale> {
  const localePrefix = options?.localePrefix ?? "always";

  /** Context locale narrowed to this instance's union — `null` outside a provider. */
  function useContextLocale(): TLocale | null {
    const contextLocale = useOptionalLocale();
    return contextLocale !== null && i18n.isLocale(contextLocale) ? contextLocale : null;
  }

  function getPathname(args: { readonly href: string; readonly locale: TLocale }): string {
    return toLocalizedPathname(args.href, args.locale, {
      defaultLocale: i18n.defaultLocale,
      localePrefix,
      locales: i18n.locales,
    });
  }

  function Link({ href, locale, ...rest }: NavigationLinkProps<TLocale>): ReactElement {
    const contextLocale = useContextLocale();
    const localizedHref = SCHEME_PATTERN.test(href)
      ? href
      : getPathname({ href, locale: locale ?? contextLocale ?? i18n.defaultLocale });
    return <NextLink href={localizedHref} {...rest} />;
  }

  function usePathname(): string {
    // `usePathname` returns null only under the Pages Router, an unsupported
    // target for this factory — fall back to the root.
    const pathname = useNextPathname();
    return stripLocalePrefix(pathname ?? "/", i18n.locales);
  }

  function useRouter(): NavigationRouter<TLocale> {
    const router = useNextRouter();
    const contextLocale = useContextLocale();
    return useMemo<NavigationRouter<TLocale>>(() => {
      const localized = (href: string, locale: TLocale | undefined): string =>
        getPathname({ href, locale: locale ?? contextLocale ?? i18n.defaultLocale });
      return {
        ...router,
        push: (href, { locale, ...rest } = {}) => router.push(localized(href, locale), rest),
        replace: (href, { locale, ...rest } = {}) => router.replace(localized(href, locale), rest),
        prefetch: (href, { locale, ...rest } = {}) =>
          // `kind` defaults to PrefetchKind.AUTO in the router runtime, so the
          // partial options are safe to hand over.
          router.prefetch(localized(href, locale), rest as NextPrefetchOptions),
      };
    }, [router, contextLocale]);
  }

  return { Link, usePathname, useRouter, getPathname };
}
