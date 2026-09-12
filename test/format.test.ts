import { describe, expect, it } from "bun:test";

import {
  createFormatters,
  formatCurrency,
  formatDateRange,
  formatDateTime,
  formatList,
  formatNumber,
  formatRelativeTime,
} from "../src/core/format";

describe("formatNumber", () => {
  it("groups digits for English", () => {
    expect(formatNumber("en", 12345.5)).toBe("12,345.5");
  });

  it("formats with locale-aware separators for German", () => {
    const result = formatNumber("de", 12345.5);
    expect(result).toContain("12");
    expect(result).toContain("345");
    expect(result).not.toBe("12,345.5");
  });
});

describe("formatCurrency", () => {
  it("includes the currency symbol for USD in English", () => {
    expect(formatCurrency("en", 19.99, "USD")).toContain("$");
  });

  it("localizes the currency output for German", () => {
    const result = formatCurrency("de", 19.99, "EUR");
    expect(result).toContain("19");
    expect(result).not.toBe("$19.99");
  });

  it("merges options without losing caller options", () => {
    expect(formatCurrency("en", 19.99, "USD", { currencyDisplay: "code" })).toContain("USD");
  });
});

describe("formatDateTime", () => {
  it("renders a long date containing the year", () => {
    const date = new Date(Date.UTC(2026, 0, 15));
    expect(formatDateTime("en", date, { dateStyle: "long", timeZone: "UTC" })).toContain("2026");
  });

  it("accepts a numeric timestamp", () => {
    const stamp = Date.UTC(2026, 0, 15);
    expect(formatDateTime("en", stamp, { dateStyle: "long", timeZone: "UTC" })).toBe(
      formatDateTime("en", new Date(stamp), { dateStyle: "long", timeZone: "UTC" })
    );
  });
});

describe("formatDateRange", () => {
  it("collapses a same-month range for English", () => {
    const start = new Date(Date.UTC(2026, 0, 10));
    const end = new Date(Date.UTC(2026, 0, 15));
    const result = formatDateRange("en", start, end, { dateStyle: "long", timeZone: "UTC" });
    expect(result).toContain("2026");
    expect(result).toContain("10");
    expect(result).toContain("15");
  });

  it("accepts numeric timestamps", () => {
    const start = Date.UTC(2026, 0, 10);
    const end = Date.UTC(2026, 0, 15);
    expect(formatDateRange("en", start, end, { timeZone: "UTC" })).toBe(
      formatDateRange("en", new Date(start), new Date(end), { timeZone: "UTC" })
    );
  });
});

describe("formatList", () => {
  it("joins items with a locale-aware conjunction", () => {
    expect(formatList("en", ["A", "B", "C"])).toBe("A, B, and C");
  });

  it("honours the type option", () => {
    expect(formatList("en", ["A", "B"], { type: "disjunction" })).toBe("A or B");
  });

  it("localizes the conjunction for Arabic", () => {
    const result = formatList("ar", ["أ", "ب"]);
    expect(result).not.toBe("أ and ب");
    expect(result).toContain("أ");
  });
});

describe("formatRelativeTime", () => {
  it("formats a past duration in English", () => {
    expect(formatRelativeTime("en", -3, "day")).toMatch(/day|days/);
  });

  it("formats a past duration in Arabic", () => {
    const result = formatRelativeTime("ar", -3, "day");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("createFormatters", () => {
  it("produces output identical to the standalone functions", () => {
    const formatters = createFormatters("en");
    const date = new Date(Date.UTC(2026, 0, 15));
    expect(formatters.number(12345.5)).toBe(formatNumber("en", 12345.5));
    expect(formatters.currency(19.99, "USD")).toBe(formatCurrency("en", 19.99, "USD"));
    expect(formatters.dateTime(date, { dateStyle: "long" })).toBe(formatDateTime("en", date, { dateStyle: "long" }));
    expect(formatters.dateRange(date, date, { dateStyle: "long" })).toBe(
      formatDateRange("en", date, date, { dateStyle: "long" })
    );
    expect(formatters.relative(-3, "day")).toBe(formatRelativeTime("en", -3, "day"));
    expect(formatters.list(["A", "B"])).toBe(formatList("en", ["A", "B"]));
  });
});

describe("formatter caching", () => {
  it("constructs one Intl.NumberFormat per locale/options key", () => {
    const Original = Intl.NumberFormat;
    const constructions: unknown[][] = [];
    Intl.NumberFormat = new Proxy(Original, {
      construct: (target, args) => {
        constructions.push(args);
        return Reflect.construct(target, args);
      },
    });
    try {
      formatNumber("fr-FR", 42);
      formatNumber("fr-FR", 43);
      expect(constructions).toHaveLength(1);
      formatNumber("fr-FR", 44, { style: "percent" });
      expect(constructions).toHaveLength(2);
    } finally {
      Intl.NumberFormat = Original;
    }
  });

  it("returns identical output for repeated calls with the same options", () => {
    expect(formatNumber("de", 12345.5)).toBe(formatNumber("de", 12345.5));
    expect(formatCurrency("en", 19.99, "USD")).toBe(formatCurrency("en", 19.99, "USD"));
    const date = new Date(Date.UTC(2026, 0, 15));
    expect(formatDateTime("en", date, { dateStyle: "long" })).toBe(formatDateTime("en", date, { dateStyle: "long" }));
    expect(formatRelativeTime("en", -3, "day")).toBe(formatRelativeTime("en", -3, "day"));
    expect(formatDateRange("en", date, date, { dateStyle: "long" })).toBe(
      formatDateRange("en", date, date, { dateStyle: "long" })
    );
    expect(formatList("de", ["A", "B"])).toBe(formatList("de", ["A", "B"]));
  });
});
