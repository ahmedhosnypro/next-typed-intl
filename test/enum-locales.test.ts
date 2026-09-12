import { describe, expect, it } from "bun:test";

import { createClientI18n, createI18n, I18nError } from "../src/index";
import { type AuthLabels, arAuth, arMessages, enAuth, enMessages } from "./fixtures/schema";

enum Locale {
  En = "en",
  Ar = "ar",
}

function makeI18n() {
  return createI18n({
    locales: [Locale.En, Locale.Ar],
    defaultLocale: Locale.En,
    messages: { [Locale.En]: enMessages, [Locale.Ar]: arMessages },
  });
}

describe("createI18n with a string enum", () => {
  it("exposes the enum locales and defaultLocale", () => {
    const i18n = makeI18n();
    expect(i18n.locales).toEqual([Locale.En, Locale.Ar]);
    expect(i18n.defaultLocale).toBe(Locale.En);
  });

  it("isLocale is exact membership against the enum values", () => {
    const i18n = makeI18n();
    expect(i18n.isLocale("en")).toBe(true);
    expect(i18n.isLocale("ar")).toBe(true);
    expect(i18n.isLocale("de")).toBe(false);
    expect(i18n.isLocale("EN")).toBe(false);
  });

  it("resolveLocale matches case-insensitively, returning the enum member", () => {
    const i18n = makeI18n();
    expect(i18n.resolveLocale("EN")).toBe(Locale.En);
    expect(i18n.resolveLocale("Ar")).toBe(Locale.Ar);
  });

  it("resolveLocale walks parent tags down to the enum member", () => {
    const i18n = makeI18n();
    expect(i18n.resolveLocale("en-US")).toBe(Locale.En);
    expect(i18n.resolveLocale("ar-SA")).toBe(Locale.Ar);
  });

  it("resolveLocale falls back to defaultLocale for unknown values", () => {
    const i18n = makeI18n();
    expect(i18n.resolveLocale("fr")).toBe(Locale.En);
    expect(i18n.resolveLocale(undefined)).toBe(Locale.En);
    expect(i18n.resolveLocale(null)).toBe(Locale.En);
  });

  it("getMessages returns the messages tree keyed by enum member", () => {
    const i18n = makeI18n();
    expect(i18n.getMessages(Locale.Ar)).toBe(arMessages);
    expect(i18n.getMessages(Locale.En)).toBe(enMessages);
    expect(i18n.getMessages()).toBe(enMessages);
  });

  it("returns typed function leaves through enum-keyed lookup", () => {
    const i18n = makeI18n();
    const ar = i18n.getMessages(Locale.Ar);
    expect(ar.greeting("أحمد")).toBe("مرحباً، أحمد!");
    expect(ar.itemCount(2)).toBe("عنصران");
  });

  it("defineNamespace + loadNamespace work with enum-keyed loaders", async () => {
    const i18n = makeI18n();
    const auth = i18n.defineNamespace<AuthLabels>("auth", {
      [Locale.En]: () => Promise.resolve(enAuth),
      [Locale.Ar]: () => Promise.resolve(arAuth),
    });
    expect(await i18n.loadNamespace(auth, "ar")).toBe(arAuth);
    expect(await i18n.loadNamespace(auth, Locale.En.toUpperCase())).toBe(enAuth);
  });

  it("canonicalizes a non-canonical enum value to its canonical tag", () => {
    enum LocaleEnUs {
      EnUs = "en-us",
    }
    const i18n = createI18n({
      locales: [LocaleEnUs.EnUs],
      defaultLocale: LocaleEnUs.EnUs,
      messages: { "en-US": enMessages },
    } as unknown as Parameters<typeof createI18n>[0]);
    expect(i18n.locales).toEqual(["en-US"]);
    expect(i18n.defaultLocale).toBe("en-US");
    expect(i18n.isLocale("en-US")).toBe(true);
    expect(i18n.getMessages("en-US")).toBe(enMessages);
    expect(i18n.resolveLocale("en-us")).toBe("en-US");
  });

  it("createClientI18n accepts the same enum config", () => {
    const client = createClientI18n({
      locales: [Locale.En, Locale.Ar],
      defaultLocale: Locale.Ar,
    });
    expect(client.locales).toEqual([Locale.En, Locale.Ar]);
    expect(client.defaultLocale).toBe(Locale.Ar);
    expect(client.resolveLocale("en-US")).toBe(Locale.En);
  });

  it("rejects a numeric enum config with INVALID_CONFIG", () => {
    enum Numeric {
      A,
      B,
    }
    try {
      createI18n({
        locales: [Numeric.A, Numeric.B] as unknown as ["en", "ar"],
        defaultLocale: "en",
        messages: { en: enMessages, ar: arMessages },
      });
      throw new Error("expected createI18n to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(I18nError);
      expect((error as I18nError).code).toBe("INVALID_CONFIG");
      expect((error as I18nError).message).toContain("must be string BCP-47 tags");
    }
  });
});
