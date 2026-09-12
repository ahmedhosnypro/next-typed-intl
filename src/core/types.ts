/**
 * A per-namespace lazy loader. Must resolve to the labels object directly —
 * use `.then((m) => m.auth)` when your locale modules do not default-export.
 */
export type NamespaceLoader<TLabels> = () => Promise<TLabels>;

/**
 * Opaque handle returned by `i18n.defineNamespace`. Carries the labels type
 * for inference; `__labels` is a phantom never present at runtime. (It is a
 * plain string key, not a unique symbol, on purpose: d.ts bundling emits a
 * separate symbol per entry, which breaks label inference across subpaths.)
 */
export interface NamespaceHandle<TLabels> {
  /** Stable unique id. Used as the load-dedup cache key. */
  readonly id: string;
  readonly __labels?: TLabels;
}

/** Options for {@link I18nInstance.seedNamespace}. */
export interface SeedNamespaceOptions {
  /** Replace an existing cached entry; defaults to first-wins. */
  readonly overwrite?: boolean;
}

/** Minimal structural view of an i18n instance, for helper signatures. */
export interface I18nInstance<TLocale extends string, TMessages> {
  /** All supported locales, in declared order. Frozen at creation. */
  readonly locales: readonly TLocale[];
  /** Fallback locale used whenever a requested locale is unknown. */
  readonly defaultLocale: TLocale;
  /** Type-narrowing check: is `value` one of the configured locales? */
  isLocale(value: string): value is TLocale;
  /** Resolve any incoming locale string to a configured locale (exact → case-insensitive → parent-tag walk → default). */
  resolveLocale(value?: string | null): TLocale;
  /** Synchronously read the eager messages tree for a locale (default when omitted). */
  getMessages(locale?: string): TMessages;
  /** Register a lazy per-locale namespace; every locale must provide a loader. */
  defineNamespace<TLabels>(id: string, loaders: Record<TLocale, NamespaceLoader<TLabels>>): NamespaceHandle<TLabels>;
  /** Start loading a namespace and return its promise, deduplicating concurrent callers. */
  loadNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): Promise<TLabels>;
  /** Suspense read: returns labels if loaded, throws the loading promise while in flight. After a rejected load it throws the recorded error (not a promise — error boundaries catch it), and the failed entry is kept rather than retried. */
  readNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): TLabels;
  /**
   * Cache lookup without side effects: returns the resolved labels if the
   * namespace is already loaded for the locale, `undefined` while loading or
   * after a failed load — safe for the React `suspense: false` path, which
   * can render a degraded state. Never starts a load and never throws a
   * loader error; an unknown handle still throws `UNKNOWN_NAMESPACE`, like
   * `readNamespace`.
   */
  peekNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): TLabels | undefined;
  /**
   * Recovery for a failed load: drop the recorded error and start a fresh
   * load (fire-and-forget) — the escape hatch for an error boundary's retry
   * (e.g. Next 16's `error.tsx` `retry()`), which otherwise re-renders into
   * the same recorded failure. A still-in-flight entry is left alone.
   */
  retryNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): void;
  /** Fire-and-forget load that warms the cache before a suspense read. */
  preloadNamespace<TLabels>(handle: NamespaceHandle<TLabels>, locale?: string): void;
  /** Warm the cache for every locale at once. */
  preloadAllLocales<TLabels>(handle: NamespaceHandle<TLabels>): void;
  /** Insert already-available labels into the cache (SSR handoff); first write wins unless `overwrite` — `overwrite: true` also recovers a failed entry. */
  seedNamespace<TLabels>(
    handle: NamespaceHandle<TLabels>,
    locale: string,
    labels: TLabels,
    options?: SeedNamespaceOptions
  ): void;
  /**
   * Insert labels keyed by the raw namespace id, bypassing the registry (the
   * namespace need not be defined yet) — for provider-level
   * `initialNamespaces` seeding where no handle is available. First write
   * wins; `labels` is stored as-is.
   */
  seedNamespaceById(id: string, locale: string, labels: unknown): void;
}

/** Instance typed for helper authors that do not know the concrete locales. */
export type AnyI18n = I18nInstance<string, unknown>;

/**
 * Client-side registry instance: same namespace machinery (lazy loaders,
 * suspense cache, seeding) without the eager messages map, so the full
 * message tree never enters the client bundle.
 */
export type ClientI18n<TLocale extends string = string> = Omit<I18nInstance<TLocale, unknown>, "getMessages">;

/** The subset of the instance the React provider and hooks actually use. */
export type I18nBridge = Pick<
  I18nInstance<string, unknown>,
  | "locales"
  | "defaultLocale"
  | "isLocale"
  | "resolveLocale"
  | "readNamespace"
  | "peekNamespace"
  | "seedNamespace"
  | "seedNamespaceById"
>;

/** The structural subset needed for locale resolution — satisfied by both
 * `createI18n` and `createClientI18n` results. */
export interface LocaleResolverShape<TLocale extends string> {
  readonly locales: readonly TLocale[];
  readonly defaultLocale: TLocale;
  isLocale(value: string): value is TLocale;
  resolveLocale(value?: string | null): TLocale;
}

/** The structural subset needed to resolve lazy namespaces. */
export type NamespaceHost = Pick<I18nInstance<string, unknown>, "resolveLocale" | "loadNamespace">;

export interface ClientI18nConfig<
  TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number] = TLocales[number],
> {
  readonly locales: TLocales;
  /** Any entry of `locales`; fallback when a requested locale is unknown. */
  readonly defaultLocale: TDefault;
  /**
   * Canonicalize every declared locale tag (and `defaultLocale`) at setup via
   * `Intl.getCanonicalLocales` (canonical RFC 5646 form: "en-us" → "en-US",
   * "EN" → "en"), so `i18n.locales`, `i18n.defaultLocale`, cookie values, URL
   * segments, and message-map keys all use the canonical form. Defaults to
   * `true`; `false` keeps the declared strings as-is. With the default, TS
   * users whose message keys are non-canonical get a compile error from the
   * parity types pointing at the canonical key.
   */
  readonly canonicalizeLocales?: boolean;
}

/**
 * Compile-time locale parity: the default locale's entry is the schema
 * source; every other locale's entry must structurally match it. A locale
 * missing a key — or adding an extra one — is a compile-time error, with no
 * annotations required:
 *
 * ```ts
 * const i18n = createI18n({
 *   locales: ["en", "ar"] as const,
 *   defaultLocale: "en", // any listed locale — it defines the schema
 *   messages: { en: enMessages, ar: arMessages }, // ar checked against en's shape
 * });
 * ```
 */
export type LocaleParity<
  TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
  TMessagesMap extends Record<TLocales[number], unknown>,
> = { [K in Exclude<TLocales[number], TDefault>]: TMessagesMap[TDefault] };

/** Configuration for {@link createI18n}. See {@link LocaleParity}. */
export interface I18nConfig<
  TLocales extends readonly [string, ...string[]],
  TDefault extends TLocales[number],
  TMessagesMap extends Record<TLocales[number], unknown>,
> extends ClientI18nConfig<TLocales, TDefault> {
  readonly messages: TMessagesMap & LocaleParity<TLocales, TDefault, TMessagesMap>;
}
