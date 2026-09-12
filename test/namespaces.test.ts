import { describe, expect, it } from "bun:test";

import { createI18n } from "../src/index";
import { type AuthLabels, arAuth, arMessages, enAuth, enMessages } from "./fixtures/schema";

function makeI18n() {
  const i18n = createI18n({
    locales: ["en", "ar"] as const,
    defaultLocale: "en",
    messages: { en: enMessages, ar: arMessages },
  });
  const auth = i18n.defineNamespace<AuthLabels>("auth", {
    en: () => Promise.resolve(enAuth),
    ar: () => Promise.resolve(arAuth),
  });
  return { i18n, auth };
}

describe("defineNamespace", () => {
  it("returns a stable handle carrying the id", () => {
    const { auth } = makeI18n();
    expect(auth.id).toBe("auth");
  });

  it("rejects duplicate ids within the same instance", () => {
    const { i18n } = makeI18n();
    expect(() =>
      i18n.defineNamespace("auth", {
        en: () => Promise.resolve(enAuth),
        ar: () => Promise.resolve(arAuth),
      })
    ).toThrow(/duplicate namespace id/);
  });

  it("rejects empty ids", () => {
    const { i18n } = makeI18n();
    expect(() =>
      i18n.defineNamespace("", { en: () => Promise.resolve(enAuth), ar: () => Promise.resolve(arAuth) })
    ).toThrow(/non-empty/);
  });

  it("rejects an unknown handle on read", () => {
    const { i18n } = makeI18n();
    const foreign = { id: "foreign" } as never;
    expect(() => i18n.readNamespace(foreign, "en")).toThrow(/Unknown namespace handle/);
  });
});

describe("namespace loading and suspense read", () => {
  it("loadNamespace resolves labels per locale", async () => {
    const { i18n, auth } = makeI18n();
    expect(await i18n.loadNamespace(auth, "en")).toBe(enAuth);
    expect(await i18n.loadNamespace(auth, "ar")).toBe(arAuth);
  });

  it("readNamespace throws the promise while loading, then returns labels", async () => {
    const { i18n, auth } = makeI18n();
    let thrown: unknown;
    try {
      i18n.readNamespace(auth, "en");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);
    await (thrown as Promise<unknown>);
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
  });

  it("deduplicates concurrent loads into a single loader invocation", async () => {
    const i18n = createI18n({
      locales: ["en", "ar"] as const,
      defaultLocale: "en",
      messages: { en: enMessages, ar: arMessages },
    });
    let callCount = 0;
    const auth = i18n.defineNamespace<AuthLabels>("auth", {
      en: () => {
        callCount++;
        return Promise.resolve(enAuth);
      },
      ar: () => Promise.resolve(arAuth),
    });

    i18n.preloadNamespace(auth, "en");
    i18n.preloadNamespace(auth, "en");
    const [a, b] = await Promise.all([i18n.loadNamespace(auth, "en"), i18n.loadNamespace(auth, "en")]);
    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });

  it("preloadAllLocales warms every locale", async () => {
    const { i18n, auth } = makeI18n();
    i18n.preloadAllLocales(auth);
    // Allow microtasks to flush.
    await Promise.resolve();
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
    expect(i18n.readNamespace(auth, "ar")).toBe(arAuth);
  });

  it("seedNamespace makes a handle synchronously readable (SSR handoff)", () => {
    const { i18n, auth } = makeI18n();
    i18n.seedNamespace(auth, "ar", arAuth);
    expect(i18n.readNamespace(auth, "ar")).toBe(arAuth);
  });

  it("seedNamespace is first-wins by default and overwrite replaces the entry", () => {
    const { i18n, auth } = makeI18n();
    const replacement: AuthLabels = { ...arAuth, login: "بديل" };
    i18n.seedNamespace(auth, "ar", arAuth);
    i18n.seedNamespace(auth, "ar", replacement);
    expect(i18n.readNamespace(auth, "ar")).toBe(arAuth);
    i18n.seedNamespace(auth, "ar", replacement, { overwrite: true });
    expect(i18n.readNamespace(auth, "ar")).toBe(replacement);
  });

  it("a failed preload is swallowed, the failure is retained, and overwrite-seeding recovers", async () => {
    const i18n = createI18n({
      locales: ["en", "ar"] as const,
      defaultLocale: "en",
      messages: { en: enMessages, ar: arMessages },
    });
    let calls = 0;
    const auth = i18n.defineNamespace<AuthLabels>("auth", {
      en: () => {
        calls++;
        return Promise.reject(new Error("load failed"));
      },
      ar: () => Promise.resolve(arAuth),
    });

    i18n.preloadNamespace(auth, "en");
    // Flush microtasks; the preload rejection is handled internally. The
    // failed entry is RETAINED (not evicted), so the loader is never
    // re-invoked for this locale and subsequent reads replay the failure.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(1);

    await expect(i18n.loadNamespace(auth, "en")).rejects.toThrow("load failed");
    expect(calls).toBe(1);
    expect(() => i18n.readNamespace(auth, "en")).toThrow("load failed");
    expect(calls).toBe(1);

    // Recovery is explicit: seed with overwrite, then reads succeed without
    // the loader ever running again.
    i18n.seedNamespace(auth, "en", enAuth, { overwrite: true });
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
    expect(calls).toBe(1);
  });

  it("loadNamespace rejections are retained: reads re-throw the recorded error and the loader is not retried", async () => {
    const { i18n } = makeI18n();
    let calls = 0;
    const failure = new Error("load failed");
    const auth = i18n.defineNamespace<AuthLabels>("retryable", {
      en: () => {
        calls++;
        return Promise.reject(failure);
      },
      ar: () => Promise.resolve(arAuth),
    });

    await expect(i18n.loadNamespace(auth, "en")).rejects.toBe(failure);
    await expect(i18n.loadNamespace(auth, "en")).rejects.toBe(failure);
    expect(calls).toBe(1);

    // Suspense reads throw the recorded error (surfacing to the nearest error
    // boundary), not a promise — forever, until an overwrite seed.
    expect(() => i18n.readNamespace(auth, "en")).toThrow("load failed");
    expect(calls).toBe(1);

    i18n.seedNamespace(auth, "en", enAuth, { overwrite: true });
    expect(i18n.readNamespace(auth, "en")).toBe(enAuth);
    expect(calls).toBe(1);

    // Other locales are unaffected and still load through their loader.
    expect(await i18n.loadNamespace(auth, "ar")).toBe(arAuth);
  });

  it("resolveLocale fallback also applies to namespace reads", async () => {
    const { i18n, auth } = makeI18n();
    expect(await i18n.loadNamespace(auth, "fr")).toBe(enAuth);
  });

  it("function labels survive the round trip", async () => {
    const { i18n, auth } = makeI18n();
    const ar = await i18n.loadNamespace(auth, "ar");
    expect(ar.welcomeBack("سارة")).toBe("مرحباً بعودتك، سارة!");
  });
});
