import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { getMessages, setRequestLocale } from "next-typed-intl/server";

import { i18n } from "@/lib/i18n.server";
import { Link } from "@/lib/navigation";

const FEATURES = [
  { key: "featureRouting", icon: "🧭" },
  { key: "featureBundle", icon: "📦" },
  { key: "featurePlural", icon: "🔢" },
  { key: "featureRtl", icon: "↔️" },
] as const;

export default async function HomePage() {
  // Same narrowing + pin as the layout: the root param is an untyped string.
  const tag = await locale();
  if (!i18n.isLocale(tag)) notFound();
  setRequestLocale(i18n, tag);
  const t = await getMessages(i18n, tag);

  return (
    <main className="content">
      <section className="hero">
        <span className="eyebrow">{t.home.eyebrow}</span>
        <h1>
          {t.home.title.split(" ").slice(0, -1).join(" ")}{" "}
          <span className="accent">{t.home.title.split(" ").at(-1)}</span>
        </h1>
        <p className="lede">{t.home.intro}</p>
        <div className="hero-actions">
          <Link href="/shop" className="btn btn-primary">
            {t.home.ctaShop}
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="section-heading">{t.home.featuresHeading}</h2>
        <div className="feature-grid">
          {FEATURES.map((feature) => {
            const copy = t.home[feature.key];
            return (
              <article key={feature.key} className="feature-card">
                <span className="feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{copy.title}</h3>
                <p>{copy.body}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
