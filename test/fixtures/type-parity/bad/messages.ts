import { createI18n } from "../../../../src/index";

interface CheckoutMessages {
  nav: { home: string; cart: string };
  total: (amount: number) => string;
}

const en: CheckoutMessages = {
  nav: { home: "Home", cart: "Cart" },
  total: (amount) => `Total: ${amount}`,
};

// Intentionally invalid: `home` is missing. This fixture must NOT compile.
const arBroken = {
  nav: { cart: "السلة" },
  total: (amount: number) => `المجموع: ${amount}`,
};

export const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  messages: { en, ar: arBroken },
});
