import { createPlural } from "next-typed-intl";

import type { CartLabels } from "../types";

const plural = createPlural("en");

export const cart: CartLabels = {
  title: "Your cart",
  checkout: "Proceed to checkout",
  itemCount: (count) =>
    // "=0" is an explicit-count form: it wins over the CLDR category match.
    plural(count, { "=0": "No items yet", one: "1 item", other: `${count} items` }),
  total: (amount) => `Total: $${amount.toFixed(2)}`,
};
