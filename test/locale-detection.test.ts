import { describe, expect, it } from "bun:test";
import { NextRequest, type NextResponse } from "next/server";

import { createI18n } from "../src/index";
import {
  createLocaleMiddleware,
  createLocaleProxy,
  DEFAULT_LOCALE_COOKIE,
  detectAcceptLanguage,
  getLocaleFromPathname,
  resolveRequestLocale,
} from "../src/next";
import { arMessages, enMessages } from "./fixtures/schema";

const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  messages: { en: enMessages, ar: arMessages },
});

describe("detectAcceptLanguage", () => {
  it("picks the highest-q supported locale", () => {
    expect(detectAcceptLanguage(i18n, "ar,en;q=0.9")).toBe("ar");
    expect(detectAcceptLanguage(i18n, "en-US,en;q=0.9,ar;q=0.8")).toBe("en");
    expect(detectAcceptLanguage(i18n, "ar-EG,ar;q=0.9")).toBe("ar");
  });

  it("falls back to the default locale when nothing matches", () => {
    expect(detectAcceptLanguage(i18n, "fr,de;q=0.8")).toBe("en");
    expect(detectAcceptLanguage(i18n, "fr-FR")).toBe("en");
  });

  it("returns the default for missing or malformed headers", () => {
    expect(detectAcceptLanguage(i18n, null)).toBe("en");
    expect(detectAcceptLanguage(i18n, undefined)).toBe("en");
    expect(detectAcceptLanguage(i18n, "")).toBe("en");
  });
});

describe("resolveRequestLocale", () => {
  it("resolves the cookie leniently (case-insensitive)", () => {
    expect(resolveRequestLocale(i18n, request("/", { cookie: `${DEFAULT_LOCALE_COOKIE}=EN` }))).toBe("en");
    expect(resolveRequestLocale(i18n, request("/", { cookie: `${DEFAULT_LOCALE_COOKIE}=Ar` }))).toBe("ar");
  });

  it("resolves POSIX-style cookie values", () => {
    expect(resolveRequestLocale(i18n, request("/", { cookie: `${DEFAULT_LOCALE_COOKIE}=en_US` }))).toBe("en");
  });

  it("falls back to the default when the cookie matches nothing", () => {
    expect(resolveRequestLocale(i18n, request("/", { cookie: `${DEFAULT_LOCALE_COOKIE}=fr` }))).toBe("en");
  });
});

describe("getLocaleFromPathname", () => {
  it("extracts a leading locale segment", () => {
    expect(getLocaleFromPathname(i18n, "/ar/dashboard")).toBe("ar");
    expect(getLocaleFromPathname(i18n, "/en")).toBe("en");
    expect(getLocaleFromPathname(i18n, "/ar")).toBe("ar");
  });

  it("extracts the locale from deep paths", () => {
    expect(getLocaleFromPathname(i18n, "/ar/shop/cart")).toBe("ar");
    expect(getLocaleFromPathname(i18n, "/en/a/b/c/d")).toBe("en");
  });

  it("returns undefined for non-locale segments", () => {
    expect(getLocaleFromPathname(i18n, "/dashboard")).toBeUndefined();
    expect(getLocaleFromPathname(i18n, "/")).toBeUndefined();
    expect(getLocaleFromPathname(i18n, "")).toBeUndefined();
    expect(getLocaleFromPathname(i18n, "/fr/dashboard")).toBeUndefined();
  });
});

const request = (path: string, headers?: Record<string, string>) =>
  new NextRequest(`http://localhost${path}`, headers ? { headers } : {});
const redirectUrl = (response: NextResponse) => new URL(response.headers.get("location") ?? "http://x.invalid/");
const stampedLocale = (response: NextResponse) => response.headers.get("x-middleware-request-x-next-typed-intl-locale");
const basePathRequest = (path: string) => {
  const req = new NextRequest(`http://localhost${path}`);
  Object.defineProperty(req.nextUrl, "basePath", { value: "/docs" });
  return req;
};

describe("locale cookie persistence and header stamping", () => {
  it("persists the cookie with Path=/, SameSite=Lax, and a one-year Max-Age by default", () => {
    const proxy = createLocaleProxy(i18n, { mode: "cookie" });
    const setCookie = proxy(request("/")).headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Max-Age=31536000");
  });

  it("honors a custom cookieMaxAge", () => {
    const proxy = createLocaleProxy(i18n, { mode: "cookie", cookieMaxAge: 3600 });
    expect(proxy(request("/")).headers.get("set-cookie")).toContain("Max-Age=3600");
  });

  it("cookieMaxAge: 0 yields a session cookie (no Max-Age)", () => {
    const proxy = createLocaleProxy(i18n, { mode: "cookie", cookieMaxAge: 0 });
    const setCookie = proxy(request("/")).headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    expect(setCookie).not.toContain("Max-Age");
  });

  it("stamps the resolved locale onto the forwarded request headers in cookie mode", () => {
    const proxy = createLocaleProxy(i18n, { mode: "cookie" });
    const response = proxy(request("/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=ar` }));
    expect(response.headers.get("location")).toBeNull();
    expect(stampedLocale(response)).toBe("ar");
  });

  it("stamps the pathname locale in prefix mode when a prefix is present", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix" });
    const response = proxy(request("/ar/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=en` }));
    expect(response.headers.get("location")).toBeNull();
    expect(stampedLocale(response)).toBe("ar");
  });

  it("stamps the resolved locale in prefix as-needed pass-throughs", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });
    const response = proxy(request("/shop"));
    expect(response.headers.get("location")).toBeNull();
    expect(stampedLocale(response)).toBe("en");
  });

  it("sets the locale cookie on prefix-mode redirects, with the same options", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix" });
    const response = proxy(request("/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=ar` }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(307);
    expect(redirectUrl(response).pathname).toBe("/ar/shop");
    expect(setCookie).toContain(`${DEFAULT_LOCALE_COOKIE}=ar`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Max-Age=31536000");
  });

  it("sets the locale cookie on as-needed prefix-strip redirects", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });
    const response = proxy(request("/en/shop"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(307);
    expect(redirectUrl(response).pathname).toBe("/shop");
    expect(setCookie).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    expect(setCookie).toContain("SameSite=lax");
  });
});

describe("createLocaleProxy", () => {
  it("exports the deprecated middleware alias as the same function", () => {
    expect(createLocaleMiddleware).toBe(createLocaleProxy);
  });

  describe("cookie mode", () => {
    const proxy = createLocaleProxy(i18n, { mode: "cookie" });

    it("sets the locale cookie without redirecting", () => {
      const response = proxy(request("/shop/cart?x=1"));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    });
  });

  describe("prefix mode with localePrefix always", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "always" });

    it("redirects unprefixed deep paths to the resolved locale, preserving the query string", () => {
      const response = proxy(request("/shop/cart?x=1"));
      expect(response.status).toBe(307);
      expect(redirectUrl(response).pathname).toBe("/en/shop/cart");
      expect(redirectUrl(response).search).toBe("?x=1");
    });

    it("redirects the root without a double slash", () => {
      const response = proxy(request("/"));
      expect(response.status).toBe(307);
      expect(redirectUrl(response).pathname).toBe("/en");
    });

    it("passes through prefixed paths and sets the cookie", () => {
      const response = proxy(request("/ar/shop/cart?x=1"));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=ar`);
    });
  });

  describe("prefix mode with localePrefix as-needed", () => {
    const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });

    it("rewrites unprefixed requests resolving to the default locale (browser URL unchanged)", () => {
      const response = proxy(request("/shop/cart?x=1"));
      const rewrite = response.headers.get("x-middleware-rewrite");
      expect(response.headers.get("location")).toBeNull();
      expect(rewrite).not.toBeNull();
      const rewriteUrl = new URL(rewrite ?? "");
      expect(rewriteUrl.pathname).toBe("/en/shop/cart");
      expect(rewriteUrl.search).toBe("?x=1");
      expect(stampedLocale(response)).toBe("en");
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    });

    it("rewrites the unprefixed root resolving to the default locale", () => {
      const response = proxy(request("/"));
      const rewrite = response.headers.get("x-middleware-rewrite");
      expect(response.headers.get("location")).toBeNull();
      expect(rewrite).not.toBeNull();
      expect(new URL(rewrite ?? "").pathname).toBe("/en");
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
    });

    it("rewrites rather than redirects so the browser URL stays unprefixed", () => {
      const response = proxy(request("/about"));
      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain("/en/about");
    });

    it("redirects unprefixed requests resolving to a non-default locale", () => {
      const response = proxy(request("/shop/cart?x=1", { cookie: `${DEFAULT_LOCALE_COOKIE}=ar` }));
      expect(response.status).toBe(307);
      expect(redirectUrl(response).pathname).toBe("/ar/shop/cart");
      expect(redirectUrl(response).search).toBe("?x=1");
    });

    it("strips the default-locale prefix by redirecting to the unprefixed path", () => {
      const response = proxy(request("/en/shop/cart?x=1"));
      expect(response.status).toBe(307);
      expect(redirectUrl(response).pathname).toBe("/shop/cart");
      expect(redirectUrl(response).search).toBe("?x=1");
    });

    it("redirects the default-prefixed root to the bare root", () => {
      const response = proxy(request("/en"));
      expect(response.status).toBe(307);
      expect(redirectUrl(response).pathname).toBe("/");
    });

    it("passes through non-default prefixed paths and sets the cookie", () => {
      const response = proxy(request("/ar/shop/cart?x=1"));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=ar`);
    });
  });

  describe("cookie-on-change behavior", () => {
    it("omits Set-Cookie on pass-throughs when the cookie already matches", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie" });
      const response = proxy(request("/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=ar` }));
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("omits Set-Cookie on as-needed rewrites when the cookie already matches", () => {
      const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });
      const response = proxy(request("/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=en` }));
      expect(response.headers.get("x-middleware-rewrite")).toContain("/en/shop");
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("sets the cookie on pass-throughs when it is absent or differs", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie" });
      expect(proxy(request("/shop")).headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=en`);
      const prefix = createLocaleProxy(i18n, { mode: "prefix" });
      const changed = prefix(request("/ar/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=en` }));
      expect(changed.headers.get("location")).toBeNull();
      expect(changed.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=ar`);
    });

    it("still sets the cookie on redirects", () => {
      const proxy = createLocaleProxy(i18n, { mode: "prefix" });
      const response = proxy(request("/shop", { cookie: `${DEFAULT_LOCALE_COOKIE}=ar` }));
      expect(response.status).toBe(307);
      expect(response.headers.get("set-cookie")).toContain(`${DEFAULT_LOCALE_COOKIE}=ar`);
    });
  });

  describe("cookieSecure", () => {
    it("does not mark the cookie Secure by default on plain http", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie" });
      expect(proxy(request("/")).headers.get("set-cookie")).not.toContain("Secure");
    });

    it("marks the cookie Secure by default on https requests", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie" });
      const response = proxy(new NextRequest("https://example.com/"));
      expect(response.headers.get("set-cookie")).toContain("Secure");
    });

    it("honors cookieSecure: false even on https requests", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie", cookieSecure: false });
      const response = proxy(new NextRequest("https://example.com/"));
      expect(response.headers.get("set-cookie")).not.toContain("Secure");
    });

    it("marks the cookie Secure when cookieSecure is true", () => {
      const proxy = createLocaleProxy(i18n, { mode: "cookie", cookieSecure: true });
      expect(proxy(request("/")).headers.get("set-cookie")).toContain("Secure");
    });
  });

  describe("basePath", () => {
    it("ignores the basePath segment when extracting the locale", () => {
      const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });
      const response = proxy(basePathRequest("/docs/ar/shop"));
      expect(response.headers.get("location")).toBeNull();
      expect(stampedLocale(response)).toBe("ar");
    });

    it("rewrites unprefixed paths under the basePath to the default locale segment", () => {
      const proxy = createLocaleProxy(i18n, { mode: "prefix", localePrefix: "as-needed" });
      const response = proxy(basePathRequest("/docs/shop"));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain("/en/shop");
    });
  });
});
