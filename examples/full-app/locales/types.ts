/** Eager (server-side) message schema. */
export interface Messages {
  nav: { home: string; shop: string };
  home: {
    eyebrow: string;
    title: string;
    intro: string;
    ctaShop: string;
    featuresHeading: string;
    featureRouting: { title: string; body: string };
    featureBundle: { title: string; body: string };
    featurePlural: { title: string; body: string };
    featureRtl: { title: string; body: string };
  };
  layout: {
    brand: string;
    tagline: string;
    footerNote: string;
  };
  shop: {
    back: string;
    loading: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
  };
}

/** Lazy namespace: product listing. */
export interface ShopLabels {
  title: string;
  subtitle: string;
  addToCart: string;
  added: string;
  soldOut: string;
  price: (amount: number) => string;
  stockNote: (count: number) => string;
  /** Ordinal plural demo: "1st most popular", "المرتبة 2", ... */
  popularityRank: (rank: number) => string;
}

/** Lazy namespace: cart summary. */
export interface CartLabels {
  title: string;
  checkout: string;
  itemCount: (count: number) => string;
  total: (amount: number) => string;
}
