"use client";

import { useState } from "react";
import { useLocale, useTranslation } from "next-typed-intl/react";

import { nsClient } from "@/lib/i18n.client";
import type { AppLocale } from "@/lib/locale-config";

const PRODUCTS = [
  { id: "notebook", icon: "📓", name: { en: "Grid notebook", ar: "دفتر شبكي" }, price: 6.5, stock: 8 },
  { id: "pen", icon: "🖋️", name: { en: "Fountain pen", ar: "قلم حبر" }, price: 24, stock: 1 },
  { id: "chair", icon: "🪑", name: { en: "Desk chair", ar: "كرسي مكتب" }, price: 189, stock: 0 },
];

export function ProductGrid() {
  const shop = useTranslation(nsClient.shop);
  const cart = useTranslation(nsClient.cart);
  const locale = useLocale<AppLocale>();
  const [basket, setBasket] = useState<readonly number[]>([]);

  const total = basket.reduce((sum, price) => sum + price, 0);

  return (
    <section>
      <ul className="product-grid">
        {PRODUCTS.map((product) => (
          <li key={product.id} className="product-card">
            <div className="product-top">
              <span className="product-rank">{shop.popularityRank(PRODUCTS.indexOf(product) + 1)}</span>
            </div>
            <span className="product-thumb" aria-hidden="true">
              {product.icon}
            </span>
            <span className="product-name">{product.name[locale]}</span>
            <div className="product-meta">
              <span className="product-price">{shop.price(product.price)}</span>
              <span className={`badge ${product.stock === 0 ? "badge-out" : "badge-stock"}`}>
                {product.stock === 0 ? shop.soldOut : shop.stockNote(product.stock)}
              </span>
            </div>
            <button
              type="button"
              className={`btn ${basket.includes(product.price) ? "btn-added" : "btn-primary"}`}
              disabled={product.stock === 0}
              onClick={() => setBasket((b) => [...b, product.price])}
            >
              {basket.includes(product.price) ? shop.added : shop.addToCart}
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-bar">
        <div className="cart-info">
          <span className="cart-title">
            {cart.title} · {cart.itemCount(basket.length)}
          </span>
          <span className="cart-total">{cart.total(total)}</span>
        </div>
        <button type="button" className="btn btn-primary" disabled={basket.length === 0}>
          {cart.checkout}
        </button>
      </div>
    </section>
  );
}
