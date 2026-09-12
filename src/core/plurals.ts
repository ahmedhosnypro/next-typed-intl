/** CLDR plural categories as reported by `Intl.PluralRules`. */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Message forms keyed by plural category. `other` is mandatory — it is the
 * fallback whenever the selected category has no form defined. ICU-style
 * explicit-count forms (`=0`, `=2`, ...) are also allowed and win over the
 * category match when the count is exactly that number.
 */
export type PluralForms = { other: string } & Partial<Record<Exclude<PluralCategory, "other">, string>> & {
    [K in `=${number}`]?: string;
  };

/** Options forwarded to `Intl.PluralRules` — includes `type` plus ES2023 rounding options. */
export type PluralOptions = Intl.PluralRulesOptions;

const rulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string, options?: PluralOptions): Intl.PluralRules {
  const key = `${locale}\0${JSON.stringify(options ?? { type: "cardinal" })}`;
  let rules = rulesCache.get(key);
  if (!rules) {
    rules = new Intl.PluralRules(locale, options);
    rulesCache.set(key, rules);
  }
  return rules;
}

/**
 * Select a message form for `count` under `locale`'s plural rules. An exact
 * `=<count>` form wins first, then the CLDR category form for `count`,
 * falling back to `forms.other` when neither is defined.
 */
export function plural(locale: string, count: number, forms: PluralForms, options?: PluralOptions): string {
  const explicit = forms[`=${count}`];
  if (explicit !== undefined) {
    return explicit;
  }
  const category = getPluralRules(locale, options).select(count);
  return forms[category] ?? forms.other;
}

/**
 * Bind a locale once; call sites (e.g. a locale's message module) then write
 * `plural(count, forms)` without repeating the locale every time.
 */
export function createPlural(locale: string, options?: PluralOptions): (count: number, forms: PluralForms) => string {
  return (count, forms) => plural(locale, count, forms, options);
}
