import { I18nError } from "./errors";
import type {
  ClientI18n,
  ClientI18nConfig,
  I18nConfig,
  I18nInstance,
  NamespaceHandle,
  NamespaceLoader,
  SeedNamespaceOptions,
} from "./types";

interface CacheEntry<TLabels> {
  readonly promise: Promise<TLabels>;
  value?: TLabels;
  /** Set once the loader rejected; the entry is kept so reads surface it. */
  error?: unknown;
}

const noop = (): void => {};

type InstanceInternals<TLocale extends string> = Omit<
  I18nInstance<TLocale, never>,
  "getMessages" | "locales" | "defaultLocale"
>;

function buildInstanceInternals<TLocale extends string>(
  locales: readonly TLocale[],
  defaultLocale: TLocale
): InstanceInternals<TLocale> {
  const localeSet = new Set<string>(locales);
  // Lowercased lookup, built on first non-exact resolve.
  let lowercaseLocales: Map<string, TLocale> | undefined;
  const registry = new Map<string, Record<string, NamespaceLoader<unknown>>>();
  // Keyed by namespace id, then locale. Promise entries are shared so
  // concurrent renders deduplicate into a single dynamic import.
  const cache = new Map<string, Map<string, CacheEntry<unknown>>>();

  function getLowercaseLocales(): Map<string, TLocale> {
    if (!lowercaseLocales) {
      lowercaseLocales = new Map();
      for (const locale of locales) {
        lowercaseLocales.set(locale.toLowerCase(), locale);
      }
    }
    return lowercaseLocales;
  }

  function resolveLocale(value?: string | null): TLocale {
    if (!value) return defaultLocale;
    // Tolerate POSIX/LANG-style underscores ("en_US" → "en-US").
    const normalized = value.includes("_") ? value.replace(/_/g, "-") : value;
    if (localeSet.has(normalized)) return normalized as TLocale;
    const insensitive = getLowercaseLocales().get(normalized.toLowerCase());
    if (insensitive !== undefined) return insensitive;
    // Parent-tag walk: "de-CH-x" → "de-CH" → "de", most specific first.
    let end = normalized.length;
    for (;;) {
      const cut = normalized.lastIndexOf("-", end - 1);
      if (cut <= 0) return defaultLocale;
      const parent = normalized.slice(0, cut);
      if (localeSet.has(parent)) return parent as TLocale;
      const insensitiveParent = getLowercaseLocales().get(parent.toLowerCase());
      if (insensitiveParent !== undefined) return insensitiveParent;
      end = cut;
    }
  }

  function isLocale(value: string): value is TLocale {
    return localeSet.has(value);
  }

  function getOrCreateLocaleCache(namespaceId: string): Map<string, CacheEntry<unknown>> {
    let localeCache = cache.get(namespaceId);
    if (!localeCache) {
      localeCache = new Map();
      cache.set(namespaceId, localeCache);
    }
    return localeCache;
  }

  function getLoadersOrThrow(id: string): Record<string, NamespaceLoader<unknown>> {
    const loaders = registry.get(id);
    if (!loaders) {
      throw new I18nError(
        "UNKNOWN_NAMESPACE",
        `Unknown namespace handle: "${id}". Was it created by this i18n instance?`
      );
    }
    return loaders;
  }

  function startLoad<TLabels>(handle: NamespaceHandle<TLabels>, locale: TLocale): CacheEntry<TLabels> {
    const loaders = getLoadersOrThrow(handle.id);

    const localeCache = getOrCreateLocaleCache(handle.id);
    const existing = localeCache.get(locale) as CacheEntry<TLabels> | undefined;
    if (existing) {
      return existing;
    }

    const loader = loaders[locale] as NamespaceLoader<TLabels>;
    const entryHolder: { entry?: CacheEntry<TLabels> } = {};
    const promise = loader().then(
      (labels) => {
        // `value` is assigned before `promise` settles, so a suspense consumer
        // resuming on `promise` always finds the resolved labels. A settled
        // entry never carries both a value and an error.
        if (entryHolder.entry) {
          entryHolder.entry.value = labels;
          entryHolder.entry.error = undefined;
        }
        return labels;
      },
      (error: unknown) => {
        // Rejected loads are kept, not evicted: suspense reads re-throw the
        // recorded error into the nearest error boundary instead of silently
        // retrying a load (a 404ing chunk would loop forever). Recovery is
        // explicit via seedNamespace with `overwrite: true`.
        if (entryHolder.entry) entryHolder.entry.error = error;
        throw error;
      }
    );
    const entry: CacheEntry<TLabels> = { promise };
    entryHolder.entry = entry;
    // Side-handler so a rejection observed only through suspense reads never
    // surfaces as an unhandled-rejection warning; the entry keeps the error.
    promise.catch(noop);

    localeCache.set(locale, entry as CacheEntry<unknown>);
    return entry;
  }

  function defineNamespace<TLabels>(
    id: string,
    loaders: Record<TLocale, NamespaceLoader<TLabels>>
  ): NamespaceHandle<TLabels> {
    if (!id) {
      throw new I18nError("INVALID_NAMESPACE_ID", "defineNamespace: a non-empty string id is required");
    }
    if (registry.has(id)) {
      throw new I18nError(
        "DUPLICATE_NAMESPACE",
        `defineNamespace: duplicate namespace id "${id}" in this i18n instance`
      );
    }
    const loaderMap = loaders as Record<string, NamespaceLoader<TLabels> | undefined>;
    for (const locale of locales) {
      if (typeof loaderMap[locale] !== "function") {
        throw new I18nError("MISSING_LOADER", `defineNamespace("${id}"): missing loader for locale "${locale}"`);
      }
    }
    registry.set(id, loaders as Record<string, NamespaceLoader<unknown>>);
    return { id };
  }

  return {
    resolveLocale,
    isLocale,

    defineNamespace,

    readNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): TLabels {
      const entry = startLoad(handle, resolveLocale(locale));
      // A recorded failure throws the original error, not a promise — this
      // surfaces to the nearest error boundary instead of re-suspending.
      if (entry.error !== undefined) throw entry.error;
      if (entry.value === undefined) {
        throw entry.promise;
      }
      return entry.value;
    },

    loadNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): Promise<TLabels> {
      return startLoad(handle, resolveLocale(locale)).promise;
    },

    preloadNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): void {
      startLoad(handle, resolveLocale(locale)).promise.catch(noop);
    },

    preloadAllLocales<TLabels>(handle: NamespaceHandle<TLabels>): void {
      for (const locale of locales) {
        startLoad(handle, locale).promise.catch(noop);
      }
    },

    seedNamespace<TLabels>(
      handle: NamespaceHandle<TLabels>,
      locale: string,
      labels: TLabels,
      options?: SeedNamespaceOptions
    ): void {
      const resolved = resolveLocale(locale);
      const localeCache = getOrCreateLocaleCache(handle.id);
      if (options?.overwrite === true || !localeCache.has(resolved)) {
        localeCache.set(resolved, { promise: Promise.resolve(labels), value: labels } as CacheEntry<unknown>);
      }
    },

    peekNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): TLabels | undefined {
      getLoadersOrThrow(handle.id);
      const entry = cache.get(handle.id)?.get(resolveLocale(locale)) as CacheEntry<TLabels> | undefined;
      if (!entry || entry.error !== undefined) return undefined;
      return entry.value;
    },

    retryNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): void {
      const resolved = resolveLocale(locale);
      // Drop the failed entry first so startLoad starts a fresh load instead
      // of replaying the recorded error — the recovery path for an error
      // boundary's retry (Next 16's error.tsx retry()) after a failed chunk.
      const localeCache = getOrCreateLocaleCache(handle.id);
      if (localeCache.get(resolved)?.error !== undefined) {
        localeCache.delete(resolved);
      }
      startLoad(handle, resolved).promise.catch(noop);
    },

    seedNamespaceById(id: string, locale: string, labels: unknown): void {
      const resolved = resolveLocale(locale);
      const localeCache = getOrCreateLocaleCache(id);
      if (!localeCache.has(resolved)) {
        localeCache.set(resolved, { promise: Promise.resolve(labels), value: labels });
      }
    },
  };
}

/**
 * Validate the factory config eagerly (JS consumers get no compile-time
 * checks). Returns a frozen canonical copy of `locales` plus the canonical
 * `defaultLocale` so later external mutation of the passed array cannot
 * desync the derived lookup maps. When `canonicalizeLocales !== false`, every
 * declared tag is canonicalized via `Intl.getCanonicalLocales` ("en-us" →
 * "en-US", "EN" → "en"); the declared `defaultLocale` is matched against the
 * declared entries first, then stored in its canonical form. With
 * `canonicalizeLocales: false`, the declared strings are kept as-is.
 */
function validateConfig(config: ClientI18nConfig<readonly [string, ...string[]], string>): {
  readonly locales: readonly string[];
  readonly defaultLocale: string;
} {
  const locales = config.locales;
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new I18nError("INVALID_CONFIG", "createI18n: `locales` must contain at least one locale");
  }
  const canonicalize = config.canonicalizeLocales !== false;
  const seen = new Set<string>();
  const canonicalLocales: string[] = [];
  for (const locale of locales) {
    if (typeof locale !== "string") {
      throw new I18nError(
        "INVALID_CONFIG",
        `createI18n: \`locales\` entries must be string BCP-47 tags (received ${typeof locale} "${String(locale)}")`
      );
    }
    let canonical = locale;
    try {
      // Always parsed for validation; the canonical form is only adopted
      // when `canonicalizeLocales !== false`. A valid tag canonicalizes to
      // at least one entry, so the first element is always present.
      const parsed = Intl.getCanonicalLocales(locale)[0];
      if (canonicalize && parsed !== undefined) canonical = parsed;
    } catch {
      throw new I18nError(
        "INVALID_CONFIG",
        `createI18n: "${locale}" is not a valid BCP-47 locale tag (use hyphens, e.g. "en-US", not "en_US")`
      );
    }
    const lower = canonical.toLowerCase();
    if (seen.has(lower)) {
      throw new I18nError(
        "INVALID_CONFIG",
        `createI18n: duplicate locale "${locale}" in \`locales\` (compared case-insensitively)`
      );
    }
    seen.add(lower);
    canonicalLocales.push(canonical);
  }
  const declaredDefault = config.defaultLocale;
  if (typeof declaredDefault !== "string") {
    throw new I18nError(
      "INVALID_CONFIG",
      `createI18n: defaultLocale must be a string BCP-47 tag (received ${typeof declaredDefault} "${String(declaredDefault)}")`
    );
  }
  let canonicalDefault = declaredDefault;
  try {
    // A valid tag canonicalizes to at least one entry, so the first element
    // is always present; fall back to the declared default otherwise.
    const parsed = Intl.getCanonicalLocales(declaredDefault)[0];
    if (canonicalize && parsed !== undefined) canonicalDefault = parsed;
  } catch {
    throw new I18nError(
      "INVALID_CONFIG",
      `createI18n: defaultLocale "${declaredDefault}" is not a valid BCP-47 locale tag`
    );
  }
  if (!canonicalLocales.includes(canonicalDefault)) {
    throw new I18nError("INVALID_CONFIG", `createI18n: defaultLocale "${declaredDefault}" is not one of \`locales\``);
  }
  return { locales: Object.freeze(canonicalLocales), defaultLocale: canonicalDefault };
}

/**
 * Create a type-safe i18n instance with an eager messages map.
 *
 * The default locale's `messages` entry is the schema source; every other
 * locale is checked against it at compile time (see {@link I18nConfig}). The
 * default locale may be any entry of `locales`, not necessarily the first.
 */
export function createI18n<
  const TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
  TMessagesMap extends Record<TLocales[number], unknown>,
>(config: I18nConfig<TLocales, TDefault, TMessagesMap>): I18nInstance<TLocales[number], TMessagesMap[TDefault]> {
  type TMessages = TMessagesMap[TDefault];

  const { locales, defaultLocale } = validateConfig(config) as {
    readonly locales: readonly TLocales[number][];
    readonly defaultLocale: TLocales[number];
  };
  const defaultMessages = (config.messages as Record<string, unknown> | undefined)?.[defaultLocale];
  if (typeof defaultMessages !== "object" || defaultMessages === null) {
    throw new I18nError("MISSING_MESSAGES", `createI18n: no messages object for defaultLocale "${defaultLocale}"`);
  }

  const internals = buildInstanceInternals(locales, defaultLocale);

  return {
    locales,
    defaultLocale,

    isLocale: internals.isLocale,

    resolveLocale: internals.resolveLocale,

    getMessages(locale?: string): TMessages {
      const resolved = internals.resolveLocale(locale);
      const entry = (config.messages as Record<string, unknown>)[resolved];
      if (typeof entry !== "object" || entry === null) {
        throw new I18nError("MISSING_MESSAGES", `No messages for locale "${resolved}"`);
      }
      return entry as TMessages;
    },

    defineNamespace: internals.defineNamespace,
    readNamespace: internals.readNamespace,
    loadNamespace: internals.loadNamespace,
    preloadNamespace: internals.preloadNamespace,
    preloadAllLocales: internals.preloadAllLocales,
    seedNamespace: internals.seedNamespace,
    peekNamespace: internals.peekNamespace,
    retryNamespace: internals.retryNamespace,
    seedNamespaceById: internals.seedNamespaceById,
  };
}

/**
 * Registry-only variant for the client bundle: the same namespace machinery
 * (lazy loaders, suspense cache, SSR seeding) without the eager messages map,
 * so nothing but the chunks a component actually renders ships to the client.
 */
export function createClientI18n<
  const TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
>(config: ClientI18nConfig<TLocales, TDefault>): ClientI18n<TLocales[number]> {
  const { locales, defaultLocale } = validateConfig(config) as {
    readonly locales: readonly TLocales[number][];
    readonly defaultLocale: TLocales[number];
  };
  const internals = buildInstanceInternals(locales, defaultLocale);

  return {
    locales,
    defaultLocale,

    isLocale: internals.isLocale,

    resolveLocale: internals.resolveLocale,
    defineNamespace: internals.defineNamespace,
    readNamespace: internals.readNamespace,
    loadNamespace: internals.loadNamespace,
    preloadNamespace: internals.preloadNamespace,
    preloadAllLocales: internals.preloadAllLocales,
    seedNamespace: internals.seedNamespace,
    peekNamespace: internals.peekNamespace,
    retryNamespace: internals.retryNamespace,
    seedNamespaceById: internals.seedNamespaceById,
  };
}
