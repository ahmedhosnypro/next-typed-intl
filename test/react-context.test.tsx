import { describe, expect, it } from "bun:test";
import { type ReactNode, Suspense } from "react";
import { renderToString } from "react-dom/server";

import { createI18n } from "../src/index";
import { createI18nContext, I18nProvider, useTranslation } from "../src/react";
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

const Typed = createI18nContext<"en" | "ar">();

describe("createI18nContext", () => {
  it("useLocale returns the locale handed to the Provider", () => {
    const { i18n } = makeI18n();
    function Probe(): ReactNode {
      // No generic argument, yet the type is the factory's union:
      const locale: "en" | "ar" = Typed.useLocale();
      return <span>{locale}</span>;
    }
    const html = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="ar">
        <Probe />
      </Typed.I18nProvider>
    );
    expect(html).toBe("<span>ar</span>");
  });

  it("hooks throw when no provider is present", () => {
    function Probe(): ReactNode {
      return <span>{Typed.useLocale()}</span>;
    }
    expect(() => renderToString(<Probe />)).toThrow(
      "next-typed-intl [INVALID_CONFIG]: no <I18nProvider> found above this component"
    );
  });

  it("provider rejects a locale outside the instance", () => {
    const { i18n } = makeI18n();
    function Probe(): ReactNode {
      return <span>{Typed.useLocale()}</span>;
    }
    expect(() =>
      renderToString(
        <I18nProvider i18n={i18n} locale="fr">
          <Probe />
        </I18nProvider>
      )
    ).toThrow('next-typed-intl [INVALID_LOCALE]: unknown locale "fr" — expected one of: en, ar');
  });

  it("useTranslation reads a namespace synchronously once preloaded", async () => {
    const { i18n, auth } = makeI18n();
    i18n.preloadNamespace(auth, "ar");
    await i18n.loadNamespace(auth, "ar");
    function Probe(): ReactNode {
      const t = Typed.useTranslation(auth);
      return <p>{t.welcomeBack("أحمد")}</p>;
    }
    const html = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="ar">
        <Probe />
      </Typed.I18nProvider>
    );
    expect(html).toBe("<p>مرحباً بعودتك، أحمد!</p>");
  });

  it("creates an isolated context per call — factory hooks do not see the top-level provider", () => {
    const { i18n } = makeI18n();
    function Probe(): ReactNode {
      return <span>{Typed.useLocale()}</span>;
    }
    expect(() =>
      renderToString(
        <I18nProvider i18n={i18n} locale="en">
          <Probe />
        </I18nProvider>
      )
    ).toThrow(/no <I18nProvider>/);
  });

  it("two factories coexist, each provider feeding only its own hooks", () => {
    const { i18n } = makeI18n();
    const Other = createI18nContext<"en" | "ar">();
    function ProbeA(): ReactNode {
      return <span>{Typed.useLocale()}</span>;
    }
    function ProbeB(): ReactNode {
      return <b>{Other.useLocale()}</b>;
    }
    const html = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="en">
        <Other.I18nProvider i18n={i18n} locale="ar">
          <ProbeA />
          <ProbeB />
        </Other.I18nProvider>
      </Typed.I18nProvider>
    );
    expect(html).toBe("<span>en</span><b>ar</b>");
    // A hook from factory B under only factory A's provider has no context.
    expect(() =>
      renderToString(
        <Typed.I18nProvider i18n={i18n} locale="en">
          <ProbeB />
        </Typed.I18nProvider>
      )
    ).toThrow(/no <I18nProvider>/);
  });
});

describe("initialNamespaces seeding and suspense:false", () => {
  it("seeds initialNamespaces before children render, so useTranslation does not suspend", () => {
    const { i18n, auth } = makeI18n();
    function Probe(): ReactNode {
      const t = Typed.useTranslation(auth);
      return <p>{t.login}</p>;
    }
    // Nothing is preloaded: without seeding, readNamespace would throw the
    // loader promise and renderToString would fail on the suspension.
    const html = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="en" initialNamespaces={{ auth: enAuth }}>
        <Probe />
      </Typed.I18nProvider>
    );
    expect(html).toBe("<p>Log in</p>");
  });

  it("top-level I18nProvider seeds initialNamespaces the same way", () => {
    const { i18n, auth } = makeI18n();
    function Probe(): ReactNode {
      const t = useTranslation(auth);
      return <p>{t.logout}</p>;
    }
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="ar" initialNamespaces={{ auth: arAuth }}>
        <Probe />
      </I18nProvider>
    );
    expect(html).toBe("<p>تسجيل الخروج</p>");
  });

  it("suspense: false returns undefined before load, then the labels after load", async () => {
    const { i18n, auth } = makeI18n();
    function Probe(): ReactNode {
      const t = Typed.useTranslation(auth, { suspense: false });
      return <p>{t === undefined ? "loading" : t.login}</p>;
    }
    const before = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="en">
        <Probe />
      </Typed.I18nProvider>
    );
    expect(before).toBe("<p>loading</p>");
    await i18n.loadNamespace(auth, "en");
    const after = renderToString(
      <Typed.I18nProvider i18n={i18n} locale="en">
        <Probe />
      </Typed.I18nProvider>
    );
    expect(after).toBe("<p>Log in</p>");
  });

  it("suspense: false stays undefined (never suspends, never throws) after a failed load", async () => {
    const i18n = createI18n({
      locales: ["en", "ar"] as const,
      defaultLocale: "en",
      messages: { en: enMessages, ar: arMessages },
    });
    const broken = i18n.defineNamespace<{ note: string }>("broken", {
      en: () => Promise.reject(new Error("boom")),
      ar: () => Promise.reject(new Error("boom")),
    });
    await i18n.loadNamespace(broken, "en").catch(() => {});
    function Probe(): ReactNode {
      const t = useTranslation(broken, { suspense: false });
      return <p>{t === undefined ? "degraded" : t.note}</p>;
    }
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="en">
        <Probe />
      </I18nProvider>
    );
    expect(html).toBe("<p>degraded</p>");
  });

  it("default useTranslation suspends until the namespace loads", () => {
    const { i18n, auth } = makeI18n();
    function Probe(): ReactNode {
      return <p>{useTranslation(auth).login}</p>;
    }
    // Not preloaded: the probe suspends and the Suspense fallback renders.
    const html = renderToString(
      <I18nProvider i18n={i18n} locale="en">
        <Suspense fallback={<span>loading</span>}>
          <Probe />
        </Suspense>
      </I18nProvider>
    );
    expect(html).toContain("<span>loading</span>");
  });
});
