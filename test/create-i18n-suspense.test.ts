import { describe, expect, it } from "bun:test";

import { createI18n } from "../src/index";
import { type AuthLabels, arAuth, arMessages, enAuth, enMessages } from "./fixtures/schema";

function makeI18nWithLoader(loader: () => Promise<AuthLabels>) {
  const i18n = createI18n({
    locales: ["en", "ar"] as const,
    defaultLocale: "en",
    messages: { en: enMessages, ar: arMessages },
  });
  const auth = i18n.defineNamespace<AuthLabels>("auth", {
    en: loader,
    ar: () => Promise.resolve(arAuth),
  });
  return { i18n, auth };
}

describe("suspense cache failure handling", () => {
  it("readNamespace re-throws the recorded error, not a promise, and never retries", async () => {
    const failure = new Error("chunk 404");
    let calls = 0;
    const { i18n, auth } = makeI18nWithLoader(() => {
      calls++;
      return Promise.reject(failure);
    });

    await expect(i18n.loadNamespace(auth, "en")).rejects.toBe(failure);

    let first: unknown;
    try {
      i18n.readNamespace(auth, "en");
    } catch (error) {
      first = error;
    }
    expect(first).toBe(failure);
    expect(first).not.toBeInstanceOf(Promise);

    let second: unknown;
    try {
      i18n.readNamespace(auth, "en");
    } catch (error) {
      second = error;
    }
    expect(second).toBe(failure);
    expect(calls).toBe(1);
  });

  it("loadNamespace keeps returning the rejecting promise without reloading", async () => {
    let calls = 0;
    const { i18n, auth } = makeI18nWithLoader(() => {
      calls++;
      return Promise.reject(new Error("boom"));
    });

    await expect(i18n.loadNamespace(auth, "en")).rejects.toThrow("boom");
    await expect(i18n.loadNamespace(auth, "en")).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });

  it("seedNamespace with overwrite recovers a failed entry", async () => {
    const { i18n, auth } = makeI18nWithLoader(() => Promise.reject(new Error("boom")));

    await expect(i18n.loadNamespace(auth, "en")).rejects.toThrow("boom");
    i18n.seedNamespace(auth, "en", enAuth, { overwrite: true });
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
  });
});

describe("peekNamespace", () => {
  it("returns undefined before any load and never starts one", async () => {
    let calls = 0;
    const { i18n, auth } = makeI18nWithLoader(() => {
      calls++;
      return Promise.resolve(enAuth);
    });

    expect(i18n.peekNamespace(auth, "en")).toBeUndefined();
    expect(calls).toBe(0);

    await i18n.loadNamespace(auth, "en");
    expect(i18n.peekNamespace(auth, "en")).toBe(enAuth);
  });

  it("returns undefined for a failed entry", async () => {
    const { i18n, auth } = makeI18nWithLoader(() => Promise.reject(new Error("boom")));

    await expect(i18n.loadNamespace(auth, "en")).rejects.toThrow("boom");
    expect(i18n.peekNamespace(auth, "en")).toBeUndefined();
  });

  it("throws for an unknown handle, like readNamespace", () => {
    const { i18n } = makeI18nWithLoader(() => Promise.resolve(enAuth));
    const foreign = { id: "foreign" } as never;
    expect(() => i18n.peekNamespace(foreign, "en")).toThrow(/Unknown namespace handle/);
  });
});

describe("seedNamespaceById", () => {
  it("seeds by raw id before the namespace is defined", () => {
    const i18n = createI18n({
      locales: ["en", "ar"] as const,
      defaultLocale: "en",
      messages: { en: enMessages, ar: arMessages },
    });
    i18n.seedNamespaceById("auth", "en", enAuth);
    const auth = i18n.defineNamespace<AuthLabels>("auth", {
      en: () => Promise.reject(new Error("must not load")),
      ar: () => Promise.resolve(arAuth),
    });
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
  });

  it("is first-wins", () => {
    const i18n = createI18n({
      locales: ["en", "ar"] as const,
      defaultLocale: "en",
      messages: { en: enMessages, ar: arMessages },
    });
    const replacement: AuthLabels = { ...enAuth, login: "Replacement" };
    i18n.seedNamespaceById("auth", "en", enAuth);
    i18n.seedNamespaceById("auth", "en", replacement);
    const auth = i18n.defineNamespace<AuthLabels>("auth", {
      en: () => Promise.reject(new Error("must not load")),
      ar: () => Promise.resolve(arAuth),
    });
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
  });
});

describe("locale config validation", () => {
  it("rejects non-BCP-47 locale tags", () => {
    expect(() =>
      createI18n({
        locales: ["en_US", "ar"] as const,
        defaultLocale: "en_US",
        messages: { en_US: enMessages, ar: arMessages },
      })
    ).toThrow(/\[INVALID_CONFIG\].*"en_US".*BCP-47/);
  });

  it("accepts valid region-tagged locales", () => {
    const i18n = createI18n({
      locales: ["en-US", "ar"] as const,
      defaultLocale: "en-US",
      messages: { "en-US": enMessages, ar: arMessages },
    });
    expect(i18n.defaultLocale).toBe("en-US");
  });
});
