import { createI18n } from "../../../../src/index";

import { ar, en } from "./shared";

// The default locale is free to sit anywhere in `locales`; parity is keyed on
// the `defaultLocale` value's type, not on its position.
export const i18n = createI18n({
  locales: ["ar", "en"] as const,
  defaultLocale: "en",
  messages: { ar, en },
});
