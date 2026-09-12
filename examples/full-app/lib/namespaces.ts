import type { NamespaceHandle } from "next-typed-intl";

import type { CartLabels, ShopLabels } from "@/locales/types";
import { Locale } from "@/lib/locale-config";

/** Anything with `defineNamespace` — satisfied by both instance kinds. */
interface NamespaceRegistrar {
  defineNamespace<TLabels>(
    id: string,
    loaders: Record<Locale, () => Promise<TLabels>>,
  ): NamespaceHandle<TLabels>;
}

/**
 * Namespace registration shared by the server and client instances. Each
 * bundle creates its own instance; handles interoperate by their string id.
 *
 * Import namespaces from `@/lib/i18n.server` in server modules and from
 * `@/lib/i18n.client` in client modules — never mix.
 */
export function registerAppNamespaces(instance: NamespaceRegistrar) {
  const shop = instance.defineNamespace<ShopLabels>("shop", {
    [Locale.En]: () => import("@/locales/en/shop").then((m) => m.shop),
    [Locale.Ar]: () => import("@/locales/ar/shop").then((m) => m.shop),
  });
  const cart = instance.defineNamespace<CartLabels>("cart", {
    [Locale.En]: () => import("@/locales/en/cart").then((m) => m.cart),
    [Locale.Ar]: () => import("@/locales/ar/cart").then((m) => m.cart),
  });
  return { shop, cart };
}
