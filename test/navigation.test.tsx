import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";

let mockedPathname = "/ar/shop";
const routerCalls = {
  push: [] as unknown[][],
  replace: [] as unknown[][],
  prefetch: [] as unknown[][],
  back: 0,
  forward: 0,
  refresh: 0,
};

mock.module("next/navigation", () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({
    push: (...args: unknown[]) => {
      routerCalls.push.push(args);
    },
    replace: (...args: unknown[]) => {
      routerCalls.replace.push(args);
    },
    prefetch: (...args: unknown[]) => {
      routerCalls.prefetch.push(args);
    },
    back: () => {
      routerCalls.back += 1;
    },
    forward: () => {
      routerCalls.forward += 1;
    },
    refresh: () => {
      routerCalls.refresh += 1;
    },
  }),
}));

// Hermetic stand-in rendering the resolved href into a plain anchor.
mock.module("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a>,
}));

const { createI18n } = await import("../src/index");
const { createNavigation, I18nProvider } = await import("../src/react/index");

type TestLocale = "en" | "ar";

function makeI18n() {
  return createI18n({
    locales: ["en", "ar"] as const,
    defaultLocale: "en" as const,
    messages: {
      en: { greeting: "hello" },
      ar: { greeting: "مرحبا" },
    },
  });
}

function makeNavigation(localePrefix?: "always" | "as-needed") {
  const i18n = makeI18n();
  const nav = createNavigation<TestLocale>(i18n, localePrefix === undefined ? undefined : { localePrefix });
  return { i18n, nav };
}

/** Render `tree`, capturing the value a hook produced inside it. */
function capture<T>(render: (assign: (value: T) => void) => ReactNode): T {
  const box: { current: T | null } = { current: null };
  renderToString(render((value) => (box.current = value)));
  if (box.current === null) throw new Error("probe never rendered");
  return box.current;
}

beforeEach(() => {
  mockedPathname = "/ar/shop";
  routerCalls.push = [];
  routerCalls.replace = [];
  routerCalls.prefetch = [];
  routerCalls.back = 0;
  routerCalls.forward = 0;
  routerCalls.refresh = 0;
});

describe("getPathname", () => {
  it("prefixes every locale under the default 'always' strategy", () => {
    const { nav } = makeNavigation();
    expect(nav.getPathname({ href: "/shop", locale: "en" })).toBe("/en/shop");
    expect(nav.getPathname({ href: "/shop", locale: "ar" })).toBe("/ar/shop");
    expect(nav.getPathname({ href: "/", locale: "ar" })).toBe("/ar");
  });

  it("leaves the default locale unprefixed under 'as-needed'", () => {
    const { nav } = makeNavigation("as-needed");
    expect(nav.getPathname({ href: "/shop", locale: "en" })).toBe("/shop");
    expect(nav.getPathname({ href: "/shop", locale: "ar" })).toBe("/ar/shop");
  });

  it("replaces an existing locale segment instead of stacking", () => {
    const { nav } = makeNavigation();
    expect(nav.getPathname({ href: "/ar/shop", locale: "en" })).toBe("/en/shop");
  });
});

describe("Link", () => {
  it("prefixes the href with the context locale", () => {
    const { i18n, nav } = makeNavigation();
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="ar">
        <nav.Link href="/shop">Shop</nav.Link>
      </I18nProvider>
    );
    expect(html).toBe('<a href="/ar/shop">Shop</a>');
  });

  it("prefers the explicit locale prop over the context locale", () => {
    const { i18n, nav } = makeNavigation();
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="ar">
        <nav.Link href="/shop" locale="en">
          Shop
        </nav.Link>
      </I18nProvider>
    );
    expect(html).toBe('<a href="/en/shop">Shop</a>');
  });

  it("falls back to the default locale outside a provider (never throws)", () => {
    const { nav } = makeNavigation();
    expect(renderToString(<nav.Link href="/shop">Shop</nav.Link>)).toBe('<a href="/en/shop">Shop</a>');
  });

  it("leaves the default locale unprefixed under 'as-needed'", () => {
    const { i18n, nav } = makeNavigation("as-needed");
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="en">
        <nav.Link href="/shop">Shop</nav.Link>
      </I18nProvider>
    );
    expect(html).toBe('<a href="/shop">Shop</a>');
  });

  it("prefixes a non-default locale under 'as-needed'", () => {
    const { nav } = makeNavigation("as-needed");
    expect(
      renderToString(
        <nav.Link href="/shop" locale="ar">
          Shop
        </nav.Link>
      )
    ).toBe('<a href="/ar/shop">Shop</a>');
  });

  it("passes external hrefs through unchanged even with a context locale", () => {
    const { i18n, nav } = makeNavigation();
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="ar">
        <nav.Link href="https://example.com/docs">Docs</nav.Link>
      </I18nProvider>
    );
    expect(html).toBe('<a href="https://example.com/docs">Docs</a>');
    expect(renderToString(<nav.Link href="mailto:team@example.com">Mail</nav.Link>)).toBe(
      '<a href="mailto:team@example.com">Mail</a>'
    );
  });
});

describe("usePathname", () => {
  it("strips the leading locale segment", () => {
    const { nav } = makeNavigation();
    const pathname = capture<string>((assign) => {
      function Probe(): ReactNode {
        assign(nav.usePathname());
        return null;
      }
      return <Probe />;
    });
    expect(pathname).toBe("/shop");
  });

  it("maps a bare locale root to '/'", () => {
    const { nav } = makeNavigation();
    mockedPathname = "/ar";
    const pathname = capture<string>((assign) => {
      function Probe(): ReactNode {
        assign(nav.usePathname());
        return null;
      }
      return <Probe />;
    });
    expect(pathname).toBe("/");
  });

  it("leaves an unprefixed pathname untouched", () => {
    const { nav } = makeNavigation();
    mockedPathname = "/shop";
    const pathname = capture<string>((assign) => {
      function Probe(): ReactNode {
        assign(nav.usePathname());
        return null;
      }
      return <Probe />;
    });
    expect(pathname).toBe("/shop");
  });
});

describe("useRouter", () => {
  function renderRouterProbe(i18n: ReturnType<typeof makeI18n>, nav: ReturnType<typeof makeNavigation>["nav"]) {
    return capture<ReturnType<typeof nav.useRouter>>((assign) => {
      function Probe(): ReactNode {
        assign(nav.useRouter());
        return null;
      }
      return (
        <I18nProvider i18n={i18n} locale="ar">
          <Probe />
        </I18nProvider>
      );
    });
  }

  it("push routes through the context locale", () => {
    const { i18n, nav } = makeNavigation();
    const router = renderRouterProbe(i18n, nav);
    router.push("/shop");
    expect(routerCalls.push).toEqual([["/ar/shop", {}]]);
  });

  it("push honors a locale override and forwards the remaining options", () => {
    const { i18n, nav } = makeNavigation();
    const router = renderRouterProbe(i18n, nav);
    router.push("/shop", { locale: "en", scroll: false });
    expect(routerCalls.push).toEqual([["/en/shop", { scroll: false }]]);
  });

  it("push keeps the default locale unprefixed under 'as-needed'", () => {
    const { i18n, nav } = makeNavigation("as-needed");
    const router = renderRouterProbe(i18n, nav);
    router.push("/shop", { locale: "en" });
    expect(routerCalls.push).toEqual([["/shop", {}]]);
  });

  it("replace and prefetch localize the same way", () => {
    const { i18n, nav } = makeNavigation();
    const router = renderRouterProbe(i18n, nav);
    router.replace("/cart");
    router.prefetch("/cart", { locale: "en" });
    expect(routerCalls.replace).toEqual([["/ar/cart", {}]]);
    expect(routerCalls.prefetch).toEqual([["/en/cart", {}]]);
  });

  it("falls back to the default locale outside a provider", () => {
    const { nav } = makeNavigation();
    const router = capture<ReturnType<typeof nav.useRouter>>((assign) => {
      function Probe(): ReactNode {
        assign(nav.useRouter());
        return null;
      }
      return <Probe />;
    });
    router.push("/shop");
    expect(routerCalls.push).toEqual([["/en/shop", {}]]);
  });

  it("back/forward/refresh pass through untouched", () => {
    const { i18n, nav } = makeNavigation();
    const router = renderRouterProbe(i18n, nav);
    router.back();
    router.forward();
    router.refresh();
    expect(routerCalls.back).toBe(1);
    expect(routerCalls.forward).toBe(1);
    expect(routerCalls.refresh).toBe(1);
  });
});
