import { describe, expect, it } from "bun:test";

import { I18nError } from "../src/index";
import { assertLocaleParity, getParityMismatches, type LocaleParityError } from "../src/testing";
import { arMessages, enMessages } from "./fixtures/schema";

describe("locale parity helpers", () => {
  it("accepts the fixture locales (function kinds match)", () => {
    expect(getParityMismatches(enMessages, arMessages)).toEqual([]);
    expect(() => assertLocaleParity(enMessages, arMessages)).not.toThrow();
  });

  it("reports missing keys with their dot path", () => {
    const incomplete = { nav: { home: "الرئيسية" }, greeting: enMessages.greeting, itemCount: enMessages.itemCount };
    const mismatches = getParityMismatches(enMessages, incomplete);
    expect(mismatches).toEqual([{ path: "nav.about", referenceKind: "string", candidateKind: "missing" }]);
  });

  it("reports kind mismatches (string vs object vs function)", () => {
    const mangled = {
      nav: "الرئيسية",
      greeting: "مرحباً",
      itemCount: enMessages.itemCount,
    };
    expect(getParityMismatches(enMessages, mangled)).toEqual([
      { path: "nav", referenceKind: "object", candidateKind: "string" },
      { path: "greeting", referenceKind: "function", candidateKind: "string" },
    ]);
  });

  it("flags candidate-only extra keys as mismatches (bidirectional)", () => {
    const augmented = {
      ...enMessages,
      nav: { ...enMessages.nav, dashboards: "لوحات" },
      legacy: "مهمل",
    };
    expect(getParityMismatches(enMessages, augmented)).toEqual([
      { path: "nav.dashboards", referenceKind: "missing", candidateKind: "string" },
      { path: "legacy", referenceKind: "missing", candidateKind: "string" },
    ]);
    expect(() => assertLocaleParity(enMessages, augmented)).toThrow(/legacy: expected missing, got string/);
  });

  it("allowExtraKeys tolerates candidate-only keys while still flagging real drift", () => {
    const augmented = { ...enMessages, legacy: "مهمل" };
    expect(getParityMismatches(enMessages, augmented, { allowExtraKeys: true })).toEqual([]);
    expect(() => assertLocaleParity(enMessages, augmented, { allowExtraKeys: true })).not.toThrow();

    const drifted = { ...enMessages, greeting: "مرحباً", legacy: "مهمل" };
    expect(getParityMismatches(enMessages, drifted, { allowExtraKeys: true })).toEqual([
      { path: "greeting", referenceKind: "function", candidateKind: "string" },
    ]);
  });

  it("throws an I18nError carrying the mismatches array", () => {
    let caught: unknown;
    try {
      assertLocaleParity(enMessages, {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(I18nError);
    const parityError = caught as LocaleParityError;
    expect(parityError.code).toBe("LOCALE_PARITY_MISMATCH");
    expect(parityError.mismatches).toEqual([
      { path: "nav", referenceKind: "object", candidateKind: "missing" },
      { path: "greeting", referenceKind: "function", candidateKind: "missing" },
      { path: "itemCount", referenceKind: "function", candidateKind: "missing" },
    ]);
  });

  it("assertLocaleParity throws a readable listing", () => {
    expect(() => assertLocaleParity(enMessages, {})).toThrow(/nav: expected object, got missing/);
  });

  it("handles a non-object candidate gracefully", () => {
    const mismatches = getParityMismatches(enMessages, "nope");
    expect(mismatches).toEqual([{ path: "", referenceKind: "object", candidateKind: "string" }]);
  });
});
