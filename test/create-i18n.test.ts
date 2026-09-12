import { describe, expect, it } from "bun:test";

import { createI18n, type I18nConfig } from "../src/index";
import { arMessages, enMessages, type TestMessages } from "./fixtures/schema";

type AnyConfig = I18nConfig<readonly [string, ...string[]], string, Record<string, TestMessages>>;

function makeI18n() {
  return createI18n({
    locales: ["en", "ar"] as const,
    defaultLocale: "en",
    messages: { en: enMessages, ar: arMessages },
  });
}

describe("createI18n", () => {
  it("exposes locales and defaultLocale", () => {
    const i18n = makeI18n();
    expect(i18n.locales).toEqual(["en", "ar"]);
    expect(i18n.defaultLocale).toBe("en");
  });

  it("isLocale validates against the configured locale set", () => {
    const i18n = makeI18n();
    expect(i18n.isLocale("en")).toBe(true);
    expect(i18n.isLocale("ar")).toBe(true);
    expect(i18n.isLocale("fr")).toBe(false);
    expect(i18n.isLocale("")).toBe(false);
  });

  it("resolveLocale falls back to the default for unknown values", () => {
    const i18n = makeI18n();
    expect(i18n.resolveLocale("ar")).toBe("ar");
    expect(i18n.resolveLocale("fr")).toBe("en");
    expect(i18n.resolveLocale(undefined)).toBe("en");
    expect(i18n.resolveLocale(null)).toBe("en");
    expect(i18n.resolveLocale("")).toBe("en");
  });

  it("resolveLocale matches case-insensitively, returning the configured casing", () => {
    const i18n = makeI18n();
    expect(i18n.resolveLocale("EN")).toBe("en");
    expect(i18n.resolveLocale("AR")).toBe("ar");
    expect(i18n.resolveLocale("Ar")).toBe("ar");
  });

  it("resolveLocale walks parent tags from most specific to least", () => {
    const i18n = createI18n({
      locales: ["de", "en"] as const,
      defaultLocale: "en",
      messages: { de: enMessages, en: enMessages },
    });
    expect(i18n.resolveLocale("de-CH")).toBe("de");
    expect(i18n.resolveLocale("de-DE")).toBe("de");
    expect(i18n.resolveLocale("en-US-x-private")).toBe("en");
    expect(i18n.resolveLocale("fr-CH")).toBe("en");
  });

  it("isLocale is exact set membership, stricter than resolveLocale", () => {
    const i18n = makeI18n();
    expect(i18n.isLocale("EN")).toBe(false);
    expect(i18n.isLocale("en-US")).toBe(false);
    expect(i18n.resolveLocale("EN")).toBe("en");
  });

  it("getMessages returns the eager messages tree per locale", () => {
    const i18n = makeI18n();
    expect(i18n.getMessages("ar")).toBe(arMessages);
    expect(i18n.getMessages("en")).toBe(enMessages);
    expect(i18n.getMessages()).toBe(enMessages);
    expect(i18n.getMessages("fr")).toBe(enMessages);
  });

  it("messages preserve function leaves", () => {
    const i18n = makeI18n();
    const ar: TestMessages = i18n.getMessages("ar");
    expect(ar.greeting("أحمد")).toBe("مرحباً، أحمد!");
    expect(ar.itemCount(2)).toBe("عنصران");
    expect(i18n.getMessages("en").itemCount(5)).toBe("5 items");
  });

  it("supports a default locale that is not the first entry", () => {
    const i18n = createI18n({
      locales: ["ar", "en"] as const,
      defaultLocale: "en",
      messages: { ar: arMessages, en: enMessages },
    });
    expect(i18n.defaultLocale).toBe("en");
    expect(i18n.resolveLocale("ar")).toBe("ar");
    expect(i18n.resolveLocale("fr")).toBe("en");
    expect(i18n.getMessages("ar")).toBe(arMessages);
    expect(i18n.getMessages()).toBe(enMessages);
  });
});

describe("locale canonicalization", () => {
  it("canonicalizes declared locale tags ('en-us' → 'en-US', 'EN' → 'en')", () => {
    const i18n = createI18n({
      locales: ["en-us", "AR"] as const,
      defaultLocale: "en-us",
      messages: { "en-US": enMessages, ar: arMessages },
    } as unknown as AnyConfig);
    expect(i18n.locales).toEqual(["en-US", "ar"]);
    expect(i18n.defaultLocale).toBe("en-US");
    expect(i18n.isLocale("en-US")).toBe(true);
    expect(i18n.isLocale("en-us")).toBe(false);
  });

  it("canonicalizes a simple case-variant tag ('EN' → 'en')", () => {
    const i18n = createI18n({
      locales: ["EN", "ar"] as const,
      defaultLocale: "EN",
      messages: { en: enMessages, ar: arMessages },
    } as unknown as AnyConfig);
    expect(i18n.locales).toEqual(["en", "ar"]);
    expect(i18n.defaultLocale).toBe("en");
    expect(i18n.getMessages("EN")).toBe(enMessages);
  });

  it("canonicalizes the defaultLocale independently of declaration casing", () => {
    const i18n = createI18n({
      locales: ["en"] as const,
      defaultLocale: "EN",
      messages: { en: enMessages },
    } as unknown as AnyConfig);
    expect(i18n.defaultLocale).toBe("en");
    expect(i18n.getMessages()).toBe(enMessages);
  });

  it("getMessages works with canonical message-map keys after canonicalization", () => {
    const i18n = createI18n({
      locales: ["en-us", "ar"] as const,
      defaultLocale: "en-us",
      messages: { "en-US": enMessages, ar: arMessages },
    } as unknown as AnyConfig);
    expect(i18n.getMessages("en-US")).toBe(enMessages);
    expect(i18n.getMessages("en-us")).toBe(enMessages);
    expect(i18n.getMessages()).toBe(enMessages);
    expect(i18n.getMessages("ar")).toBe(arMessages);
  });

  it("resolveLocale still resolves non-canonical inputs to the canonical key", () => {
    const i18n = createI18n({
      locales: ["en-us", "ar"] as const,
      defaultLocale: "en-us",
      messages: { "en-US": enMessages, ar: arMessages },
    } as unknown as AnyConfig);
    expect(i18n.resolveLocale("en-us")).toBe("en-US");
    expect(i18n.resolveLocale("EN-US")).toBe("en-US");
    expect(i18n.resolveLocale("en_US")).toBe("en-US");
    expect(i18n.resolveLocale("en-US-x-private")).toBe("en-US");
    expect(i18n.resolveLocale("fr")).toBe("en-US");
  });

  it("rejects canonical-duplicate locales ('en-US' vs 'en-us')", () => {
    expect(() =>
      createI18n({
        locales: ["en-US", "en-us"] as const,
        defaultLocale: "en-US",
        messages: { "en-US": enMessages },
      } as unknown as AnyConfig)
    ).toThrow(/\[INVALID_CONFIG\].*duplicate locale/);
  });

  it("canonicalizeLocales: false keeps the declared strings", () => {
    const i18n = createI18n({
      locales: ["EN", "en-us"] as const,
      defaultLocale: "EN",
      messages: { EN: enMessages, "en-us": arMessages },
      canonicalizeLocales: false,
    });
    expect(i18n.locales).toEqual(["EN", "en-us"]);
    expect(i18n.defaultLocale).toBe("EN");
    expect(i18n.isLocale("EN")).toBe(true);
    expect(i18n.isLocale("en")).toBe(false);
    expect(i18n.resolveLocale("EN")).toBe("EN");
    expect(i18n.resolveLocale("en-us")).toBe("en-us");
    expect(i18n.getMessages("en-us")).toBe(arMessages);
  });

  it("canonicalizeLocales: false still validates tags and rejects duplicates case-insensitively", () => {
    expect(() =>
      createI18n({
        locales: ["en_US", "ar"] as const,
        defaultLocale: "en_US",
        messages: { en_US: enMessages, ar: arMessages },
        canonicalizeLocales: false,
      })
    ).toThrow(/\[INVALID_CONFIG\].*"en_US".*BCP-47/);
    expect(() =>
      createI18n({
        locales: ["EN", "en"] as const,
        defaultLocale: "EN",
        messages: { EN: enMessages, en: arMessages },
        canonicalizeLocales: false,
      })
    ).toThrow(/\[INVALID_CONFIG\].*duplicate locale/);
  });
});
