import type { Messages } from "./types";

export const enMessages: Messages = {
  nav: { home: "Home", shop: "Shop" },
  home: {
    eyebrow: "Full-pattern demo",
    title: "Typed i18n, end to end",
    intro:
      "Locale-prefixed routing, a zero-eager client bundle, lazy namespaces with suspense, and Arabic plural forms — all compile-time checked.",
    ctaShop: "Browse the shop",
    featuresHeading: "What this demo covers",
    featureRouting: {
      title: "Prefix routing",
      body: "Every URL carries its locale — /en/shop, /ar/shop — with redirects and statically prerendered routes.",
    },
    featureBundle: {
      title: "Zero-eager bundle",
      body: "The client ships a registry and lazy loaders only; no eager message map crosses the server boundary.",
    },
    featurePlural: {
      title: "Typed plurals",
      body: "CLDR plural categories are checked at compile time as forms — including Arabic's six and ICU-style explicit counts.",
    },
    featureRtl: {
      title: "RTL ready",
      body: "The document direction flips for Arabic, and the layout mirrors using logical CSS properties.",
    },
  },
  layout: {
    brand: "Typed Intl Outfitters",
    tagline: "next-typed-intl on Next.js 16",
    footerNote: "An example project for the next-typed-intl library.",
  },
  shop: {
    back: "Back to home",
    loading: "Loading products…",
    errorTitle: "Something went wrong.",
    errorBody: "The product catalog failed to load.",
    retry: "Try again",
  },
};
