import { createPlural } from "next-typed-intl";

import type { ShopLabels } from "../types";

const plural = createPlural("ar");
const ordinal = createPlural("ar", { type: "ordinal" });

export const shop: ShopLabels = {
  title: "المتجر",
  subtitle: "مساحة أسماء كَسولة التحميل: بُثَّ هذا القسم كاملًا إلى المتصفح.",
  addToCart: "أضف إلى السلة",
  added: "أُضيف ✓",
  soldOut: "نفدت الكمية",
  price: (amount) => `${amount.toFixed(2)} ر.س`,
  stockNote: (count) =>
    plural(count, {
      zero: "نفد المخزون",
      one: "لم يتبقَّ سوى قطعة واحدة",
      two: "لم يتبقَّ سوى قطعتين",
      few: `لم يتبقَّ سوى ${count} قطع`,
      many: `لم يتبقَّ سوى ${count} قطعةً`,
      other: `لم يتبقَّ سوى ${count} قطعة`,
    }),
  // Arabic ordinal rules map everything to "other".
  popularityRank: (rank) => ordinal(rank, { other: `المرتبة ${rank} في قائمة الأكثر رواجًا` }),
};
