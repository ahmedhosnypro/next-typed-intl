import { I18nError } from "./errors";
import { formatNumber } from "./format";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type AsciiLower =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

/** Case-folded membership in `a-z` restricts letters to ASCII, matching `\w`. */
type IsWordChar<C extends string> = C extends Digit | "_" ? true : Lowercase<C> extends AsciiLower ? true : false;

/** Mirrors the runtime placeholder grammar: `[A-Za-z0-9_]+`. */
type IsWordName<S extends string> = S extends ""
  ? false
  : S extends `${infer Head}${infer Tail}`
    ? IsWordChar<Head> extends true
      ? Tail extends ""
        ? true
        : IsWordName<Tail>
      : false
    : false;

/**
 * Placeholder names present in a template literal type, extracted at compile
 * time: `PlaceholderNames<"Hi {name}, you have {count}">` is `"name" | "count"`.
 * Escaped braces are skipped — `{{name}}` yields no placeholder (it renders
 * literally as `{name}`) — and names outside the runtime `\w` grammar
 * (`{first-name}`) render literally and are skipped here too.
 */
export type PlaceholderNames<T extends string> = T extends `${infer Head}{${infer Rest}`
  ? Rest extends `${infer Name}}${infer Tail}`
    ? Head extends `${string}{`
      ? PlaceholderNames<Tail>
      : Tail extends `}${string}`
        ? PlaceholderNames<Tail>
        : IsWordName<Name> extends true
          ? Name | PlaceholderNames<Tail>
          : PlaceholderNames<Tail>
    : never
  : never;

/** Options for {@link interpolate}. */
export interface InterpolateOptions {
  /**
   * When set, `number` values are formatted with {@link formatNumber} for
   * this locale instead of plain `String(value)` coercion.
   */
  readonly locale?: string;
}

function isWordCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    code === 95 || // _
    (code >= 97 && code <= 122) // a-z
  );
}

/**
 * Replace `{name}` placeholders in `template` with the given values. The
 * template is scanned left to right: `{{` and `}}` in the template text are
 * escapes rendering a literal `{` / `}`, a `{` name matching `\w+` followed
 * by `}` is a placeholder, and any other brace is literal text. Substituted
 * values are inserted verbatim — a value containing `{{` is never re-scanned.
 *
 * For literal templates the required keys are known at compile time: a
 * missing placeholder value is a type error, and extra values must still be
 * `string | number`.
 *
 * Strict: every placeholder in the template must have a matching key in
 * `values` — otherwise an Error is thrown listing the missing names.
 */
export function interpolate<T extends string>(
  template: T,
  values: Record<PlaceholderNames<T>, string | number> & Record<string, string | number>,
  options?: InterpolateOptions
): string {
  const missing = new Set<string>();
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "{") {
      if (template[i + 1] === "{") {
        out += "{";
        i += 2;
        continue;
      }
      let end = i + 1;
      while (end < template.length && isWordCode(template.charCodeAt(end))) end++;
      if (end > i + 1 && template[end] === "}") {
        const name = template.slice(i + 1, end);
        const value = values[name];
        if (value === undefined) {
          missing.add(name);
          out += template.slice(i, end + 1);
        } else {
          out +=
            typeof value === "number" && options?.locale !== undefined
              ? formatNumber(options.locale, value)
              : String(value);
        }
        i = end + 1;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === "}" && template[i + 1] === "}") {
      out += "}";
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  if (missing.size > 0) {
    throw new I18nError("MISSING_PLACEHOLDER", `missing values for placeholders: ${[...missing].join(", ")}`);
  }
  return out;
}
