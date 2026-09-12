import { createI18n } from "../../../../src/index";

import { ar, en } from "./shared";

export const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  messages: { en, ar },
});
