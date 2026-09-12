type IntlOptions =
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  | Intl.RelativeTimeFormatOptions
  | Intl.ListFormatOptions;

function cached<T>(cache: Map<string, T>, locale: string, options: IntlOptions | undefined, create: () => T): T {
  const key = `${locale}\0${JSON.stringify(options ?? {})}`;
  let instance = cache.get(key);
  if (!instance) {
    instance = create();
    cache.set(key, instance);
  }
  return instance;
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormatCache = new Map<string, Intl.RelativeTimeFormat>();
const listFormatCache = new Map<string, Intl.ListFormat>();

/** Format a number with locale-aware grouping and digits. */
export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return cached(numberFormatCache, locale, options, () => new Intl.NumberFormat(locale, options)).format(value);
}

/** Format a number as a localized currency amount. */
export function formatCurrency(
  locale: string,
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions
): string {
  const merged = { ...options, style: "currency", currency } as const;
  return cached(numberFormatCache, locale, merged, () => new Intl.NumberFormat(locale, merged)).format(value);
}

/** Format a date/time with locale-aware calendar, month names, and ordering. */
export function formatDateTime(locale: string, date: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return cached(dateTimeFormatCache, locale, options, () => new Intl.DateTimeFormat(locale, options)).format(date);
}

/** Format a date/time interval ("Jan 10 – 15, 2026") with locale-aware collapsing. */
export function formatDateRange(
  locale: string,
  start: Date | number,
  end: Date | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return cached(dateTimeFormatCache, locale, options, () => new Intl.DateTimeFormat(locale, options)).formatRange(
    start,
    end
  );
}

/** Format a relative time span ("3 days ago", "in 2 hours") with locale-aware phrasing. */
export function formatRelativeTime(
  locale: string,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions
): string {
  return cached(relativeTimeFormatCache, locale, options, () => new Intl.RelativeTimeFormat(locale, options)).format(
    value,
    unit
  );
}

/** Format a list of items ("A, B, and C") with locale-aware separators and conjunction. */
export function formatList(locale: string, items: readonly string[], options?: Intl.ListFormatOptions): string {
  return cached(listFormatCache, locale, options, () => new Intl.ListFormat(locale, options)).format(items);
}

/** Locale-bound formatting helpers, ready to hang off a message context. */
export interface Formatters {
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  currency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string;
  dateTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  dateRange: (start: Date | number, end: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  relative: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
  list: (items: readonly string[], options?: Intl.ListFormatOptions) => string;
}

/** Bind all formatting helpers to a single locale. */
export function createFormatters(locale: string): Formatters {
  return {
    number: (value, options) => formatNumber(locale, value, options),
    currency: (value, currency, options) => formatCurrency(locale, value, currency, options),
    dateTime: (date, options) => formatDateTime(locale, date, options),
    dateRange: (start, end, options) => formatDateRange(locale, start, end, options),
    relative: (value, unit, options) => formatRelativeTime(locale, value, unit, options),
    list: (items, options) => formatList(locale, items, options),
  };
}
