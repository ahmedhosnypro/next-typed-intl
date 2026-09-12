import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { TranslationBoundary } from "next-typed-intl/react";
import { getMessages, getNamespace, setRequestLocale } from "next-typed-intl/server";

import { ProductGrid } from "@/components/product-grid";
import { i18n, ns } from "@/lib/i18n.server";
import { Link } from "@/lib/navigation";

export default async function ShopPage() {
  const tag = await locale();
  if (!i18n.isLocale(tag)) notFound();
  setRequestLocale(i18n, tag);
  const t = await getMessages(i18n, tag);
  // The same lazy namespace can also be awaited server-side for the HTML shell.
  const shop = await getNamespace(i18n, ns.shop, tag);

  return (
    <main className="content">
      <header className="shop-header">
        <Link href="/" className="back-link">
          <span className="arrow" aria-hidden="true">←</span>
          {t.shop.back}
        </Link>
        <h1>{shop.title}</h1>
        <p className="lede">{shop.subtitle}</p>
      </header>
      <TranslationBoundary
        fallback={
          <div className="loading-panel" role="status">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <p>{t.shop.loading}</p>
          </div>
        }
      >
        <ProductGrid />
      </TranslationBoundary>
    </main>
  );
}
