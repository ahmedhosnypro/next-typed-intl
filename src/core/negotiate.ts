import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import type { LocaleResolverShape } from "./types";

/**
 * Pure Accept-Language resolution using `negotiator` + `@formatjs/intl-localematcher`
 * (the pair recommended by the Next.js internationalization guide). Returns
 * the best-supported locale, or the default when nothing matches.
 */
export function detectAcceptLanguage<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  acceptLanguageHeader: string | null | undefined
): TLocale {
  if (!acceptLanguageHeader) return i18n.defaultLocale;
  try {
    const languages = new Negotiator({ headers: { "accept-language": acceptLanguageHeader } }).languages();
    const matched = match(languages, [...i18n.locales], i18n.defaultLocale);
    return i18n.isLocale(matched) ? matched : i18n.defaultLocale;
  } catch {
    return i18n.defaultLocale;
  }
}
