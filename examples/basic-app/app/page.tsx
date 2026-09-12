import { TranslationBoundary } from "next-typed-intl/react";
import { getMessages, getNamespace, getRequestLocale } from "next-typed-intl/server";

import { CodeIcon } from "@/components/icons";
import { LocaleSegments } from "@/components/locale-segments";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Counter } from "@/components/counter";
import { counterNamespace, i18n } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getRequestLocale(i18n);
  // Eager surface: the whole typed messages tree, awaited, server-side.
  const t = await getMessages(i18n, locale);
  // The same lazy namespace can also be read on the server when needed.
  const counterLabels = await getNamespace(i18n, counterNamespace, locale);

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ti
          </div>
          <div className="brand-name">
            <span className="brand-title">next-typed-intl</span>
            <span className="brand-sub">example</span>
          </div>
        </div>
        <div className="header-controls">
          <ThemeToggle label={t.themeToggle.label} />
          <LocaleSegments label={t.switcher.label} />
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div className="badge-chip">
            <span className="badge-dot" />
            <span>{t.home.badge}</span>
          </div>
          <h1 className="hero-title">
            <span className="gradient-text">{t.home.titleAccent}</span> {t.home.titleRest}
          </h1>
          <p className="hero-tagline">{t.home.tagline}</p>
          <div className="server-note">
            <CodeIcon />
            <span>
              {t.home.serverNotePrefix} <code>getMessages()</code>
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="kicker">{t.switcher.label.toUpperCase()}</span>
            <span className="chip">{t.switcher.clientChip}</span>
          </div>
          <div className="card-row">
            <p className="card-desc">{t.switcher.description}</p>
            <LocaleSwitcher label={t.switcher.switchLabel} switchTo={t.switcher.switchTo} />
          </div>
        </section>

        <section className="card card-pad-lg">
          <div className="card-head">
            <span className="kicker">{t.counterCard.kicker}</span>
            <span className="chip chip-emerald">
              <span className="chip-dot" />
              {t.counterCard.dynamicChip}
            </span>
          </div>
          <p className="card-hint">{t.counterCard.hint}</p>
          <TranslationBoundary fallback={<p className="loading-note">{t.counterCard.loading}</p>}>
            <Counter />
          </TranslationBoundary>
        </section>
      </main>

      <footer className="site-footer">
        <p>{t.footer.line}</p>
      </footer>
    </div>
  );
}
