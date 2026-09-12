"use client";

import "client-only";

import { type Context, createContext, type ReactElement, type ReactNode, useContext, useMemo } from "react";
import { I18nError } from "../core/errors";
import type { I18nBridge, NamespaceHandle } from "../index";

interface I18nContextValue {
  readonly i18n: I18nBridge;
  readonly locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Fail fast when the handed locale is not one of the instance's locales. */
function assertKnownLocale(i18n: I18nBridge, locale: string): void {
  if (!i18n.isLocale(locale)) {
    throw new I18nError("INVALID_LOCALE", `unknown locale "${locale}" — expected one of: ${i18n.locales.join(", ")}`);
  }
}

/**
 * Options for {@link useTranslation}. Pass `{ suspense: false }` to opt out
 * of suspending: the hook then returns `undefined` until the namespace has
 * loaded, and keeps returning `undefined` (instead of throwing) after a
 * failed load.
 */
export interface UseTranslationOptions {
  readonly suspense?: boolean;
}

/**
 * Seed `initialNamespaces` into the cache during render — useMemo runs before
 * any child renders, so every entry is in place before a child reads it.
 * `seedNamespaceById` is first-wins, so re-rendering with the same payload
 * is a no-op.
 */
function useSeedNamespaces(
  i18n: I18nBridge,
  locale: string,
  initialNamespaces: Record<string, unknown> | undefined
): void {
  useMemo(() => {
    if (initialNamespaces === undefined) return;
    for (const [id, labels] of Object.entries(initialNamespaces)) {
      i18n.seedNamespaceById(id, locale, labels);
    }
  }, [i18n, locale, initialNamespaces]);
}

export interface I18nProviderProps {
  /**
   * The instance whose registry the components below read from.
   *
   * NOTE: functions cannot cross the Server→Client Component boundary, so do
   * NOT receive this via props from an RSC. Create the instance module-side
   * and hand it inside your own `"use client"` wrapper:
   *
   * ```tsx
   * "use client";
   * import { I18nProvider } from "next-typed-intl/react";
   * import { i18n } from "@/lib/i18n";
   * export function AppI18nProvider({ locale, children }) {
   *   return <I18nProvider i18n={i18n} locale={locale}>{children}</I18nProvider>;
   * }
   * ```
   */
  readonly i18n: I18nBridge;
  /** Active locale; must be one of `i18n.locales`, checked at render. */
  readonly locale: string;
  /**
   * Pre-seeded labels for the provider locale, keyed by namespace id — the
   * SSR handoff payload; a cache entry that already exists wins (seeding is
   * first-wins per namespace). Inserted during render, before any child
   * reads a namespace, so `useTranslation` below resolves synchronously for
   * these namespaces instead of suspending. This implements the README's
   * `initialNamespaces` prop.
   */
  readonly initialNamespaces?: Record<string, unknown>;
  readonly children: ReactNode;
}

export function I18nProvider({ i18n, locale, initialNamespaces, children }: I18nProviderProps): ReactElement {
  assertKnownLocale(i18n, locale);
  useSeedNamespaces(i18n, locale, initialNamespaces);
  const value = useMemo(() => ({ i18n, locale }), [i18n, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function makeUseI18nContext(context: Context<I18nContextValue | null>): () => I18nContextValue {
  return () => {
    const ctx = useContext(context);
    if (!ctx) {
      throw new I18nError("INVALID_CONFIG", "no <I18nProvider> found above this component");
    }
    return ctx;
  };
}

const useI18nContext = makeUseI18nContext(I18nContext);

/** The i18n instance handed to the nearest {@link I18nProvider} above. */
export function useI18n(): I18nBridge {
  return useI18nContext().i18n;
}

/**
 * Current locale. The narrowing cast is sound by construction: the provider
 * rejects unknown locales at render time, so the value read here is always
 * one of the instance's locales. Pass your union explicitly when you need
 * it narrower than `string`, e.g. `useLocale<"en" | "ar">()`.
 */
export function useLocale<TLocale extends string = string>(): TLocale {
  return useI18nContext().locale as TLocale;
}

/**
 * Current locale, or `null` when no {@link I18nProvider} is present above —
 * never throws. For locale-aware components (e.g. navigation) that must also
 * render outside a provider, falling back to their instance's default locale.
 */
export function useOptionalLocale(): string | null {
  return useContext(I18nContext)?.locale ?? null;
}

/**
 * Read a namespace's labels for the current locale.
 *
 * Default (`{ suspense?: true }`): suspends (throws the loader promise)
 * until the namespace chunk has loaded — wrap rendered output in a
 * {@link TranslationBoundary} or a plain <Suspense>. After a failed load the
 * recorded error is thrown instead (error boundaries catch it).
 *
 * `{ suspense: false }`: never suspends and never throws a loader error;
 * returns `undefined` while the namespace is loading and after a failed
 * load, so you can render a degraded state. Nothing starts the load on its
 * own — preload it (or let a suspending sibling trigger it) and re-render.
 */
export function useTranslation<TLabels>(handle: NamespaceHandle<TLabels>, options?: { suspense?: true }): TLabels;
export function useTranslation<TLabels>(
  handle: NamespaceHandle<TLabels>,
  options: { suspense: false }
): TLabels | undefined;
export function useTranslation<TLabels>(
  handle: NamespaceHandle<TLabels>,
  options?: UseTranslationOptions
): TLabels | undefined {
  const { i18n, locale } = useI18nContext();
  if (options?.suspense === false) return i18n.peekNamespace(handle, locale);
  return i18n.readNamespace(handle, locale);
}

/** Props accepted by the provider created by {@link createI18nContext}. */
export interface TypedI18nProviderProps<TLocale extends string> {
  /** The instance whose registry the components below read from. */
  readonly i18n: I18nBridge;
  /** Active locale — narrowed to the union the factory was created with. */
  readonly locale: TLocale;
  /**
   * Pre-seeded labels for the provider locale, keyed by namespace id — the
   * SSR handoff payload; a cache entry that already exists wins (seeding is
   * first-wins per namespace). Inserted during render, before any child
   * reads a namespace, so `useTranslation` below resolves synchronously for
   * these namespaces instead of suspending. This implements the README's
   * `initialNamespaces` prop.
   */
  readonly initialNamespaces?: Record<string, unknown>;
  readonly children: ReactNode;
}

/** The provider + hooks set returned by {@link createI18nContext}. */
export interface TypedI18nContext<TLocale extends string> {
  /** Provider with `locale` narrowed to `TLocale`, bound to this factory's own context. */
  readonly I18nProvider: (props: TypedI18nProviderProps<TLocale>) => ReactElement;
  /** Current locale, already narrowed to `TLocale` — no generic needed at call sites. */
  readonly useLocale: () => TLocale;
  /** Factory-bound equivalent of the top-level {@link useTranslation}. */
  readonly useTranslation: {
    <TLabels>(handle: NamespaceHandle<TLabels>, options?: { suspense?: true }): TLabels;
    <TLabels>(handle: NamespaceHandle<TLabels>, options: { suspense: false }): TLabels | undefined;
  };
  /** Factory-bound equivalent of the top-level {@link useI18n}. */
  readonly useI18n: () => I18nBridge;
}

/**
 * Create an isolated `I18nProvider` + hooks set pre-bound to your locale
 * union, so consumers get a fully typed `useLocale()` without repeating the
 * generic:
 *
 * ```tsx
 * const { I18nProvider, useLocale, useTranslation } = createI18nContext<"en" | "ar">();
 * // useLocale() is "en" | "ar", not string
 * ```
 *
 * Each call creates its own React context, so two factories never share
 * state and can render side by side in one tree. Factory hooks resolve
 * against their own factory's provider ONLY: do not mix factory hooks with
 * the top-level hooks (or another factory's provider) under one provider —
 * a factory hook without its own provider above throws the no-provider
 * error.
 */
export function createI18nContext<TLocale extends string>(): TypedI18nContext<TLocale> {
  const context = createContext<I18nContextValue | null>(null);
  const useContextValue = makeUseI18nContext(context);

  function TypedI18nProvider({
    i18n,
    locale,
    initialNamespaces,
    children,
  }: TypedI18nProviderProps<TLocale>): ReactElement {
    assertKnownLocale(i18n, locale);
    useSeedNamespaces(i18n, locale, initialNamespaces);
    const value = useMemo(() => ({ i18n, locale: locale as string }), [i18n, locale]);
    return <context.Provider value={value}>{children}</context.Provider>;
  }

  function useTypedLocale(): TLocale {
    return useContextValue().locale as TLocale;
  }

  function useTypedTranslation<TLabels>(handle: NamespaceHandle<TLabels>, options?: { suspense?: true }): TLabels;
  function useTypedTranslation<TLabels>(
    handle: NamespaceHandle<TLabels>,
    options: { suspense: false }
  ): TLabels | undefined;
  function useTypedTranslation<TLabels>(
    handle: NamespaceHandle<TLabels>,
    options?: UseTranslationOptions
  ): TLabels | undefined {
    const { i18n, locale } = useContextValue();
    if (options?.suspense === false) return i18n.peekNamespace(handle, locale);
    return i18n.readNamespace(handle, locale);
  }

  return {
    I18nProvider: TypedI18nProvider,
    useLocale: useTypedLocale,
    useTranslation: useTypedTranslation,
    useI18n: () => useContextValue().i18n,
  };
}
