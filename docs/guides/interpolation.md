# Interpolation

`next-typed-intl` has no ICU message parser. A message is a plain template
string with `{name}` placeholders, and `interpolate` fills them in — with
compile-time checking of the required values, verbatim substitution, and an
optional locale that formats numbers in the target locale's digits and
grouping.

## Basic usage

Import `interpolate` from the core entry:

```ts
import { interpolate } from "next-typed-intl";

interpolate("Welcome back, {name} — {count} new messages", { name: "Sara", count: 5 });
// "Welcome back, Sara — 5 new messages"
```

Values may be strings or numbers. Numbers are coerced with `String(value)`
unless a `locale` option is given (see below).

## Number formatting with `locale`

The optional third argument, `InterpolateOptions`, has a single field
`locale`. When set, every `number` value is formatted with
[`formatNumber`](./formatting.md) for that locale instead of plain string
coercion:

```ts
import { interpolate } from "next-typed-intl";

interpolate("{count} items", { count: 1234 }, { locale: "ar" });
// "١٬٢٣٤ items" — Arabic digits with localized grouping
```

This pairs naturally with a resolved request locale:

```ts
import { interpolate } from "next-typed-intl";
import { getRequestLocale } from "next-typed-intl/server";

const locale = getRequestLocale();
interpolate(messages.cartSummary, { count: 1234 }, { locale });
```

## The grammar, precisely

The template is scanned left to right. Four rules decide what every brace
means:

- **Placeholder names are `\w` only** — `[A-Za-z0-9_]+`. A brace name outside
  that grammar, e.g. `{first-name}`, is **literal text**, not a placeholder.
  Rename such keys in your catalogs to words or underscores.
- **`{{` and `}}` are escapes** — they render a literal `{` and `}`:

  ```ts
  interpolate("Use {{name}} as the key", { name: "Sara" });
  // "Use {name} as the key" — never substituted
  ```

  If you're porting catalogs, mind the flip: in i18next and Handlebars
  `{{name}}` is the *placeholder*. Here filtered/escaped variants don't exist,
  so `{{name}}` in an imported catalog means a *literal*, and the real
  placeholder must be written as `{name}`.
- **Substituted values are inserted verbatim** — a value containing braces is
  never re-scanned or re-escaped:

  ```ts
  interpolate("Saved as {value}", { value: "{{value}}" });
  // "Saved as {{value}}" — the value is not substituted again
  ```
- **Any other brace is literal text.** A `{` that isn't followed by a `\w`
  name and `}`, or a `}` not followed by another `}`, passes through
  unchanged.

## Compile-time checking with `PlaceholderNames<T>`

When the template is a string literal, its placeholder names are extracted at
compile time via the exported `PlaceholderNames<T>` type:

```ts
import type { PlaceholderNames } from "next-typed-intl";

type Names = PlaceholderNames<"Hi {name}, you have {count} new messages">;
// "name" | "count"
```

`interpolate`'s `values` parameter is typed against it, so a missing value is
a **type error** before the code can ever run:

```ts
interpolate("Hi {name}", {});
// type error: property 'name' is missing

interpolate("Hi {name}", { name: true });
// type error: values must be string | number

interpolate("Hi {name}", { name: "Sara", role: "admin" });
// fine — extra values are allowed as long as they are string | number
```

Escaped and non-`\w` braces yield no placeholder, so they impose no
requirement: `PlaceholderNames<"Use {{name}} or {first-name}">` is `never`.

## Strict by default at runtime

Every placeholder in the template must have a matching key in `values`. If one
is missing, `interpolate` throws an `I18nError` with code
[`MISSING_PLACEHOLDER`](../reference/errors.md), listing all missing names:

```ts
import { I18nError } from "next-typed-intl";

try {
  interpolate("Hi {name}, you have {count} new messages", { name: "Sara" });
} catch (error) {
  if (error instanceof I18nError && error.code === "MISSING_PLACEHOLDER") {
    error.message; // next-typed-intl [MISSING_PLACEHOLDER]: missing values for placeholders: count
  }
}
```

Runtime strictness matters for templates that aren't string literals — messages
read from a store at runtime carry no literal type, so the type level can't
check them and the throw is the safety net. For literal templates the
compile-time check fires first; the runtime check still applies if values are
built dynamically (e.g. a value typed `string | undefined` slips through a
cast).

Missing placeholders don't fail at the first brace: the scan collects all of
them (leaving the raw placeholder text in the output as it goes) and throws
once at the end, naming every missing placeholder. Because it throws, no
partial result is ever returned.
