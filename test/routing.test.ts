import { describe, expect, it } from "bun:test";

import { stripLocalePrefix, toLocalizedPathname } from "../src/next";

const LOCALES = ["en", "ar"] as const;

describe("toLocalizedPathname", () => {
  it("inserts the locale at the front of an unprefixed pathname", () => {
    expect(toLocalizedPathname("/shop", "ar", { defaultLocale: "en" })).toBe("/ar/shop");
    expect(toLocalizedPathname("/shop/cart", "en", { defaultLocale: "en" })).toBe("/en/shop/cart");
  });

  it("prefixes the default locale by default (localePrefix always)", () => {
    expect(toLocalizedPathname("/shop", "en", { defaultLocale: "en" })).toBe("/en/shop");
  });

  it("replaces an existing locale segment", () => {
    expect(toLocalizedPathname("/ar/shop", "en", { defaultLocale: "en", locales: LOCALES })).toBe("/en/shop");
    expect(toLocalizedPathname("/en/shop", "ar", { defaultLocale: "en", locales: LOCALES })).toBe("/ar/shop");
  });

  it("recognizes the default-locale segment without an explicit locales list", () => {
    expect(toLocalizedPathname("/en/shop", "ar", { defaultLocale: "en" })).toBe("/ar/shop");
  });

  it("handles the root without producing a trailing slash", () => {
    expect(toLocalizedPathname("/", "ar", { defaultLocale: "en" })).toBe("/ar");
    expect(toLocalizedPathname("/en", "ar", { defaultLocale: "en" })).toBe("/ar");
  });

  describe("localePrefix as-needed", () => {
    it("returns the pathname unprefixed for the default locale", () => {
      const options = { defaultLocale: "en", localePrefix: "as-needed" } as const;
      expect(toLocalizedPathname("/shop", "en", options)).toBe("/shop");
      expect(toLocalizedPathname("/", "en", options)).toBe("/");
    });

    it("strips an existing default-locale segment", () => {
      const options = { defaultLocale: "en", localePrefix: "as-needed" } as const;
      expect(toLocalizedPathname("/en/shop", "en", options)).toBe("/shop");
      expect(toLocalizedPathname("/en", "en", options)).toBe("/");
    });

    it("still prefixes non-default locales", () => {
      const options = { defaultLocale: "en", localePrefix: "as-needed" } as const;
      expect(toLocalizedPathname("/shop", "ar", options)).toBe("/ar/shop");
      expect(toLocalizedPathname("/en/shop", "ar", options)).toBe("/ar/shop");
    });
  });
});

describe("stripLocalePrefix", () => {
  it("strips a first segment that matches a configured locale", () => {
    expect(stripLocalePrefix("/ar/shop", LOCALES)).toBe("/shop");
    expect(stripLocalePrefix("/en/a/b/c", LOCALES)).toBe("/a/b/c");
  });

  it("returns '/' when the locale is the whole path", () => {
    expect(stripLocalePrefix("/ar", LOCALES)).toBe("/");
  });

  it("returns the pathname unchanged when the first segment is not a locale", () => {
    expect(stripLocalePrefix("/shop", LOCALES)).toBe("/shop");
    expect(stripLocalePrefix("/fr/shop", LOCALES)).toBe("/fr/shop");
    expect(stripLocalePrefix("/", LOCALES)).toBe("/");
  });

  it("only considers the first segment", () => {
    expect(stripLocalePrefix("/shop/ar", LOCALES)).toBe("/shop/ar");
  });
});
