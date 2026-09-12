import { createPlural } from "next-typed-intl";

import type { ShopLabels } from "../types";

const plural = createPlural("en");
const ordinal = createPlural("en", { type: "ordinal" });

export const shop: ShopLabels = {
  title: "The shop",
  subtitle: "Lazy-loaded namespace: this whole section stream-loaded in the browser.",
  addToCart: "Add to cart",
  added: "Added ✓",
  soldOut: "Sold out",
  price: (amount) => `$${amount.toFixed(2)}`,
  stockNote: (count) =>
    count === 0
      ? "Out of stock"
      : plural(count, { one: "Only 1 left in stock", other: `${count} in stock` }),
  popularityRank: (rank) =>
    ordinal(rank, {
      one: `${rank}st most popular`,
      two: `${rank}nd most popular`,
      few: `${rank}rd most popular`,
      other: `${rank}th most popular`,
    }),
};
