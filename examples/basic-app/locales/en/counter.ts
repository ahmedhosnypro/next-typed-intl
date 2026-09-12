import { createPlural } from "next-typed-intl";

import type { CounterLabels } from "../types";

const plural = createPlural("en");

export const counter: CounterLabels = {
  heading: "Lazy namespace: counter",
  hint: "Loaded on demand by the client bundle via a dynamic import.",
  increment: "Increment",
  reset: "Reset",
  // "=0" is an ICU-style explicit-count form: it wins over the CLDR category
  // match whenever the count is exactly zero.
  countLabel: (count) => plural(count, { "=0": "No clicks yet", one: "1 click", other: `${count} clicks` }),
};
