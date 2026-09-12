import { describe, expect, it } from "bun:test";

import { formatNumber } from "../src/core/format";
import { interpolate, type PlaceholderNames } from "../src/core/interpolate";

describe("interpolate", () => {
  it("replaces multiple placeholders", () => {
    expect(interpolate("{greeting}, {name}!", { greeting: "Hello", name: "Ada" })).toBe("Hello, Ada!");
  });

  it("coerces numbers to strings", () => {
    expect(interpolate("You have {count} items", { count: 5 })).toBe("You have 5 items");
  });

  it("replaces repeated placeholders", () => {
    expect(interpolate("{x} and {x}", { x: "same" })).toBe("same and same");
  });

  it("throws naming the missing placeholder with the library prefix", () => {
    // @ts-expect-error the values record must satisfy every placeholder in the literal template
    expect(() => interpolate("Hi {name}", {})).toThrow(
      /^next-typed-intl \[MISSING_PLACEHOLDER\]: missing values for placeholders: name$/
    );
  });

  it("lists every missing placeholder in the error", () => {
    // @ts-expect-error the values record must satisfy every placeholder in the literal template
    expect(() => interpolate("{a} / {b} / {c}", { b: "ok" })).toThrow(/a[\s\S]*c/);
  });

  it("ignores extra values with no matching placeholder", () => {
    expect(interpolate("{name} only", { name: "Ada", unused: "extra" })).toBe("Ada only");
  });

  it("rejects non-string/number values at compile time", () => {
    // @ts-expect-error extra values must still be string | number
    interpolate("{name} only", { name: "Ada", unused: true });
  });

  it("returns templates without placeholders unchanged", () => {
    expect(interpolate("no placeholders", {})).toBe("no placeholders");
  });

  it("treats doubled braces as an escaped literal, not a placeholder", () => {
    expect(interpolate("Use {{name}} literally", {})).toBe("Use {name} literally");
  });

  it("does not substitute an escaped placeholder even when a value is provided", () => {
    expect(interpolate("{{name}} and {name}", { name: "Ada" })).toBe("{name} and Ada");
  });

  it("unescapes lone doubled braces", () => {
    expect(interpolate("a{{b}}c", {})).toBe("a{b}c");
  });

  it("inserts values containing escape sequences verbatim", () => {
    expect(interpolate("code: {code}", { code: "a {{ b }}" })).toBe("code: a {{ b }}");
  });

  it("treats names outside the \\w grammar as literal text", () => {
    expect(interpolate("Dear {first-name},", {})).toBe("Dear {first-name},");
    expect(interpolate("empty {} braces", {})).toBe("empty {} braces");
  });

  it("formats number values with formatNumber when a locale is given", () => {
    const withLocale = interpolate("{n} items", { n: 1234 }, { locale: "ar" });
    expect(withLocale).toBe(`${formatNumber("ar", 1234)} items`);
    expect(withLocale).not.toBe("1234 items");
    expect(interpolate("{n} items", { n: 1234 })).toBe("1234 items");
    expect(interpolate("{n} items", { n: 1234 }, {})).toBe("1234 items");
  });
});

describe("PlaceholderNames", () => {
  it("extracts placeholder names from literal templates", () => {
    const single: PlaceholderNames<"Hi {name}"> = "name";
    const pair: PlaceholderNames<"{greeting}, {name}!"> = "greeting";
    expect(single).toBe("name");
    expect(pair).toBe("greeting");
  });

  it("skips escaped double-brace placeholders", () => {
    const escaped: PlaceholderNames<"{{name}} is literal"> = null as never;
    const mixed: PlaceholderNames<"{{skip}} and {keep}"> = "keep";
    expect(escaped).toBeNull();
    expect(mixed).toBe("keep");
  });

  it("skips names outside the runtime word grammar at the type level", () => {
    // @ts-expect-error {first-name} renders literally, so it extracts no placeholder
    const dashed: PlaceholderNames<"Dear {first-name},"> = "first-name";
    const mixed: PlaceholderNames<"{ok} vs {not-ok}"> = "ok";
    expect(String(dashed)).toBe("first-name");
    expect(mixed).toBe("ok");
  });

  it("resolves dynamic strings to no required keys", () => {
    const dynamic: string = "Hi {name}";
    expect(interpolate(dynamic, { name: "Ada" })).toBe("Hi Ada");
  });
});
