export interface CheckoutMessages {
  nav: { home: string; cart: string };
  total: (amount: number) => string;
}

export const en: CheckoutMessages = {
  nav: { home: "Home", cart: "Cart" },
  total: (amount) => `Total: ${amount}`,
};

export const ar: CheckoutMessages = {
  nav: { home: "الرئيسية", cart: "السلة" },
  total: (amount) => `المجموع: ${amount}`,
};
