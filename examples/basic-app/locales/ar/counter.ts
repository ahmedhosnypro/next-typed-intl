import { createPlural } from "next-typed-intl";

import type { CounterLabels } from "../types";

const plural = createPlural("ar");

export const counter: CounterLabels = {
  heading: "نطاق أسماء يُحمَّل عند الطلب: العدّاد",
  hint: "يُحمَّل عند الطلب ضمن حزمة العميل عبر الاستيراد الديناميكي.",
  increment: "زيادة",
  reset: "تصفير",
  countLabel: (count) =>
    plural(count, {
      // "=0" صيغة عدد صريحة: تتغلّب على فئة CLDR عندما يكون العدد صفراً.
      "=0": "لا نقرات بعد",
      one: "نقرة واحدة",
      two: "نقرتان",
      few: `${count} نقرات`,
      many: `${count} نقرة`,
      other: `${count} نقرة`,
    }),
};
