import { beforeEach, describe, expect, it, mock } from "bun:test";

const headerStore = new Map<string, string>();
const cookieStore = new Map<string, string>();
/** Call counters proving (for the override path) that `headers()`/`cookies()` were never touched. */
const io = { headers: 0, cookies: 0 };

mock.module("server-only", () => ({}));
// React's client build ships `cache` as an identity function; the
// request-scoped variant only exists under the react-server condition.
// Emulate request-scoped memoization so the `setRequestLocale` override
// persists across calls the way it does per request in a real RSC tree.
// (Nothing else in this graph imports react, so a `{ cache }`-only module
// stands in for the whole package.)
mock.module("react", () => ({
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    const results = new Map<string, R>();
    return (...args: A): R => {
      const key = JSON.stringify(args);
      if (!results.has(key)) results.set(key, fn(...args));
      return results.get(key) as R;
    };
  },
}));
mock.module("next/headers", () => ({
  headers: async () => {
    io.headers += 1;
    return { get: (name: string) => headerStore.get(name.toLowerCase()) ?? null };
  },
  cookies: async () => {
    io.cookies += 1;
    return {
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value === undefined ? undefined : { value };
      },
    };
  },
}));

const { createI18n, I18nError } = await import("../src/index");
const { getMessages, getNamespace, getRequestLocale, setRequestLocale } = await import("../src/server/index");
const { LOCALE_HEADER } = await import("../src/core/constants");

function makeI18n() {
  return createI18n({
    locales: ["en", "ar"] as const,
    defaultLocale: "en",
    messages: {
      en: { greeting: "hello" },
      ar: { greeting: "مرحبا" },
    },
  });
}

beforeEach(() => {
  headerStore.clear();
  cookieStore.clear();
  io.headers = 0;
  io.cookies = 0;
});

describe("getRequestLocale", () => {
  it("stamped proxy header wins over cookie and Accept-Language", async () => {
    const i18n = makeI18n();
    headerStore.set(LOCALE_HEADER, "ar");
    headerStore.set("accept-language", "en");
    cookieStore.set("NEXT_LOCALE", "en");
    expect(await getRequestLocale(i18n)).toBe("ar");
  });

  it("cookie wins over Accept-Language", async () => {
    const i18n = makeI18n();
    cookieStore.set("NEXT_LOCALE", "ar");
    headerStore.set("accept-language", "en");
    expect(await getRequestLocale(i18n)).toBe("ar");
  });

  it("negotiates Accept-Language when no stamped header or cookie", async () => {
    const i18n = makeI18n();
    headerStore.set("accept-language", "ar-EG, ar;q=0.9, en;q=0.8");
    expect(await getRequestLocale(i18n)).toBe("ar");
  });

  it("falls back to the default locale when nothing matches", async () => {
    const i18n = makeI18n();
    headerStore.set("accept-language", "fr-FR, fr;q=0.9");
    expect(await getRequestLocale(i18n)).toBe("en");
    headerStore.clear();
    expect(await getRequestLocale(i18n)).toBe("en");
  });

  it("spoofed/invalid stamped header falls through to the cookie", async () => {
    const i18n = makeI18n();
    headerStore.set(LOCALE_HEADER, "xx");
    cookieStore.set("NEXT_LOCALE", "ar");
    expect(await getRequestLocale(i18n)).toBe("ar");
  });

  it("resolves the cookie leniently (case-insensitive)", async () => {
    const i18n = makeI18n();
    cookieStore.set("NEXT_LOCALE", "AR");
    expect(await getRequestLocale(i18n)).toBe("ar");
  });

  it("skips Accept-Language when detectAcceptLanguage is false", async () => {
    const i18n = makeI18n();
    headerStore.set("accept-language", "ar");
    expect(await getRequestLocale(i18n, { detectAcceptLanguage: false })).toBe("en");
  });

  it("repeat calls with identical signals return the same locale", async () => {
    const i18n = makeI18n();
    headerStore.set("accept-language", "ar, en;q=0.5");
    const first = await getRequestLocale(i18n);
    const second = await getRequestLocale(i18n);
    expect(first).toBe("ar");
    expect(second).toBe(first);
  });
});

describe("getMessages", () => {
  it("returns the tree for an explicit locale", async () => {
    const i18n = makeI18n();
    cookieStore.set("NEXT_LOCALE", "en");
    expect(await getMessages(i18n, "ar")).toEqual({ greeting: "مرحبا" });
  });

  it("omitted locale resolves through the request context", async () => {
    const i18n = makeI18n();
    headerStore.set(LOCALE_HEADER, "ar");
    expect(await getMessages(i18n)).toEqual({ greeting: "مرحبا" });
    headerStore.clear();
    cookieStore.set("NEXT_LOCALE", "en");
    expect(await getMessages(i18n)).toEqual({ greeting: "hello" });
  });

  it("omitted locale falls back to the default when the request has no signals", async () => {
    const i18n = makeI18n();
    expect(await getMessages(i18n)).toEqual({ greeting: "hello" });
  });
});

function makeNamespace(i18n: ReturnType<typeof makeI18n>) {
  const calls = { en: 0, ar: 0 };
  const handle = i18n.defineNamespace("checkout", {
    en: async () => {
      calls.en += 1;
      return { title: "Checkout" };
    },
    ar: async () => {
      calls.ar += 1;
      return { title: "الدفع" };
    },
  });
  return { handle, calls };
}

describe("getNamespace", () => {
  it("explicit locale loads that locale's loader", async () => {
    const i18n = makeI18n();
    const { handle, calls } = makeNamespace(i18n);
    cookieStore.set("NEXT_LOCALE", "en");
    expect(await getNamespace(i18n, handle, "ar")).toEqual({ title: "الدفع" });
    expect(calls.ar).toBe(1);
    expect(calls.en).toBe(0);
  });

  it("omitted locale resolves through the request context", async () => {
    const i18n = makeI18n();
    const { handle, calls } = makeNamespace(i18n);
    headerStore.set(LOCALE_HEADER, "ar");
    expect(await getNamespace(i18n, handle)).toEqual({ title: "الدفع" });
    expect(calls.ar).toBe(1);
    expect(calls.en).toBe(0);
  });
});

// NOTE: runs last — the emulated request-scope cache makes the override
// process-global in tests; the INVALID_LOCALE test throws before mutating.
describe("setRequestLocale", () => {
  it("override wins over every signal without touching headers()/cookies()", async () => {
    const i18n = makeI18n();
    headerStore.set(LOCALE_HEADER, "en");
    headerStore.set("accept-language", "en");
    cookieStore.set("NEXT_LOCALE", "en");
    setRequestLocale(i18n, "ar");
    expect(await getRequestLocale(i18n)).toBe("ar");
    expect(io.headers).toBe(0);
    expect(io.cookies).toBe(0);
  });

  it("throws INVALID_LOCALE naming the received and configured values", () => {
    const i18n = makeI18n();
    let caught: unknown;
    try {
      // Locale generic widens to accept any string here; the cast stands in
      // for an untyped (plain-JS or runtime-sourced) call site.
      setRequestLocale(i18n, "fr" as never);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(I18nError);
    expect(caught).toMatchObject({ code: "INVALID_LOCALE" });
    expect((caught as Error).message).toContain('"fr"');
    expect((caught as Error).message).toContain("en, ar");
  });
});
