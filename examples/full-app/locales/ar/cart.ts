import { createPlural } from "next-typed-intl";

import type { CartLabels } from "../types";

const plural = createPlural("ar");

export const cart: CartLabels = {
  title: "سلتك",
  checkout: "إتمام الشراء",
  itemCount: (count) =>
    plural(count, {
      // Explicit-count form wins over the category match; Arabic's category
      // for 0 is "zero" — "=0" applies before it.
      "=0": "لا منتجات في السلة بعد",
      zero: "لا توجد منتجات في السلة",
      one: "منتج واحد في السلة",
      two: "منتجان في السلة",
      few: `${count} منتجات في السلة`,
      many: `${count} منتجًا في السلة`,
      other: `${count} منتجًا في السلة`,
    }),
  total: (amount) => `الإجمالي: ${amount.toFixed(2)} ر.س`,
};
