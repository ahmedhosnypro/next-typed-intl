import { describe, expect, it } from "bun:test";

import { createPlural, type PluralForms, plural } from "../src/core/plurals";

const enForms: PluralForms = { one: "one item", other: "many items" };

const arForms: PluralForms = {
  zero: "لا عناصر",
  one: "عنصر واحد",
  two: "عنصران",
  few: "عناصر قليلة",
  many: "عناصر كثيرة",
  other: "عنصر",
};

describe("plural", () => {
  it("selects one/other for English", () => {
    expect(plural("en", 1, enForms)).toBe("one item");
    expect(plural("en", 0, enForms)).toBe("many items");
    expect(plural("en", 2, enForms)).toBe("many items");
  });

  it("selects all six categories for Arabic", () => {
    expect(plural("ar", 0, arForms)).toBe("لا عناصر");
    expect(plural("ar", 1, arForms)).toBe("عنصر واحد");
    expect(plural("ar", 2, arForms)).toBe("عنصران");
    expect(plural("ar", 3, arForms)).toBe("عناصر قليلة");
    expect(plural("ar", 5, arForms)).toBe("عناصر قليلة");
    expect(plural("ar", 11, arForms)).toBe("عناصر كثيرة");
    expect(plural("ar", 100, arForms)).toBe("عنصر");
  });

  it("selects few/many for Russian", () => {
    const ruForms: PluralForms = { one: "один", few: "несколько", many: "много", other: "другое" };
    expect(plural("ru", 2, ruForms)).toBe("несколько");
    expect(plural("ru", 3, ruForms)).toBe("несколько");
    expect(plural("ru", 4, ruForms)).toBe("несколько");
    expect(plural("ru", 5, ruForms)).toBe("много");
    expect(plural("ru", 21, ruForms)).toBe("один");
  });

  it("falls back to other when the selected category has no form", () => {
    const sparse: PluralForms = { other: "fallback" };
    expect(plural("en", 1, sparse)).toBe("fallback");
    expect(plural("ar", 2, sparse)).toBe("fallback");
  });

  it("prefers an explicit =count form over the category match", () => {
    const explicit: PluralForms = { "=0": "no items", one: "one item", other: "many items" };
    expect(plural("en", 0, explicit)).toBe("no items");
    expect(plural("en", 1, explicit)).toBe("one item");
    expect(plural("en", 5, explicit)).toBe("many items");
  });

  it("prefers an explicit =count form over a matching non-other category", () => {
    const explicit: PluralForms = { "=1": "exactly one!", one: "one item", other: "many items" };
    expect(plural("en", 1, explicit)).toBe("exactly one!");
  });

  it("selects ordinal categories when type is ordinal", () => {
    const ordinals: PluralForms = { one: "{n}st", two: "{n}nd", few: "{n}rd", other: "{n}th" };
    expect(plural("en", 1, ordinals, { type: "ordinal" })).toBe("{n}st");
    expect(plural("en", 2, ordinals, { type: "ordinal" })).toBe("{n}nd");
    expect(plural("en", 3, ordinals, { type: "ordinal" })).toBe("{n}rd");
    expect(plural("en", 4, ordinals, { type: "ordinal" })).toBe("{n}th");
    expect(plural("en", 2, ordinals)).toBe("{n}th");
  });
});

describe("createPlural", () => {
  it("binds the locale so call sites pass only count and forms", () => {
    const arPlural = createPlural("ar");
    expect(arPlural(1, arForms)).toBe("عنصر واحد");
    expect(arPlural(2, arForms)).toBe("عنصران");
  });

  it("produces independent instances across locales", () => {
    const enPlural = createPlural("en");
    const ruPlural = createPlural("ru");
    const forms: PluralForms = { one: "one", few: "few", many: "many", other: "other" };
    expect(enPlural(2, forms)).toBe("other");
    expect(ruPlural(2, forms)).toBe("few");
  });

  it("binds the rules type so ordinal call sites omit the option", () => {
    const enOrdinal = createPlural("en", { type: "ordinal" });
    const forms: PluralForms = { one: "st", two: "nd", few: "rd", other: "th" };
    expect(enOrdinal(1, forms)).toBe("st");
    expect(enOrdinal(4, forms)).toBe("th");
  });
});
