# Rich text rendering

Message templates can carry inline tags — `<b>`, `<link>`, `<my-icon>` — that
map to React nodes at render time, so translators keep markup in the message
and components keep rendering React. `renderRichText` is the single entry
point for this: it parses the template, walks the chunks, and calls one
renderer per tag. The tag set is extracted from the template's literal type at
compile time, so a missing renderer is a type error before the app ever runs.

## Choosing an import path

`renderRichText` ships from two entry points:

- `next-typed-intl/rich` — the canonical module. It is **RSC-safe**: it
  carries no `client-only` or `server-only` guard, so it works in Server
  Components, Client Components, and anywhere else React runs.
- `next-typed-intl/react` — re-exports `renderRichText` (plus the `TagNames`
  and `RichTextRenderers` types). This entry is marked `client-only`, so use
  it from client code that already imports from there.

Import it from `next-typed-intl/rich` for Server Components:

```tsx
import { renderRichText } from "next-typed-intl/rich";

renderRichText("By continuing you accept the <link>terms</link>.", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
});
```

Or from `next-typed-intl/react` for client code:

```tsx
"use client";

import { renderRichText } from "next-typed-intl/react";
```

## Typed renderers

The renderer record is keyed by the tags actually present in the template.
`TagNames<"Click <b>here</b> or <i>there</i>">` resolves to `"b" | "i"`, and
`RichTextRenderers<T>` requires one `(chunks: ReactNode) => ReactNode`
function per extracted tag:

```tsx
renderRichText("Click <b>here</b> or <i>there</i>.", {
  b: (chunks) => <strong>{chunks}</strong>,
  i: (chunks) => <em>{chunks}</em>,
});
```

Omit a tag and the call site fails to compile with an error naming the
missing key:

```tsx
// @ts-expect-error — missing renderer for `i`
renderRichText("Click <b>here</b> or <i>there</i>.", {
  b: (chunks) => <strong>{chunks}</strong>,
});
```

Each renderer receives the already-rendered inner chunks as a single
`ReactNode` and returns the node to place at that tag's position. Nesting is
supported: the chunks passed to an outer renderer already contain the output
of the inner ones.

```tsx
renderRichText("Go to <link>the <b>docs</b></link>.", {
  link: (chunks) => <a href="/docs">{chunks}</a>,
  b: (chunks) => <strong>{chunks}</strong>,
});
// <a href="/docs">the <strong>docs</strong></a>
```

## Grammar

The parser understands `[a-zA-Z][a-zA-Z0-9-]*` tag names in `<name>...</name>`
form, plus two extensions:

- **Self-closing tags** — `<br/>` or `<icon/>` produce no inner chunks; their
  renderer is called with `null`:

  ```tsx
  renderRichText("Line one<br/>Line two", {
    br: () => <br />,
  });
  ```

- **Hyphenated tag names** — `<my-icon>` is a valid tag, so component-like
  names work without renaming:

  ```tsx
  renderRichText("Saved <check/> successfully", {
    "my-icon": (chunks) => <MyIcon />,
    check: () => <CheckIcon />,
  });
  ```

## Literal `<`

A `<` that cannot start a tag is literal text, not an error — comparisons in
messages just work:

```tsx
renderRichText("5 < 10 items", {}); // "5 < 10 items"
```

The runtime rules:

- A `<` not followed by a letter or `</` + letter (e.g. `"5 < 10"`,
  `"a </3 b"`) renders as plain text and contributes no tag names.
- A `<` followed by a letter that then isn't a valid tag (e.g. `<3` in a
  position the grammar reads as a tag opener) throws.
- Unbalanced, mismatched, or unexpected closing tags throw.

Malformed markup fails fast with an `I18nError` carrying the
`MALFORMED_RICH_TEXT` code and a message naming the offending tag — the
output is never silently mangled. See
[Errors](../reference/errors.md) for the full error catalog.

## Memoized parsing

Parsing is memoized per template string. Templates repeat across renders —
every render of every subscriber would otherwise re-parse — so parse results
are cached and shared read-only. The cache holds up to 500 templates and
clears wholesale when the cap is reached; message templates are finite per
app, so this stays warm in practice. Rendering itself folds chunks into
nested fragments rather than arrays, so React never needs keys — chunk order
is fixed by the template and nothing reorders.

## API reference

Full signatures for `renderRichText`, `TagNames`, and `RichTextRenderers`
live in [the `rich` entry reference](../reference/rich.md). Related guides:
[Interpolation](./interpolation.md) for placeholders inside the same
messages.
