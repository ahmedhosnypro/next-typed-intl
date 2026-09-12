# Rich text — `next-typed-intl/rich`

The `next-typed-intl/rich` entry renders tagged message templates — strings like `"Click <b>here</b>"` — into React nodes with one renderer per tag. It has no dependencies on client-only or server-only guards, so it is safe to import from **both** Server Components and client code (`next-typed-intl/react` also re-exports `renderRichText` for client bundles). The tag set is extracted from the template's literal type at compile time, so an incomplete renderer map fails to compile, and template parsing is memoized so repeated renders never re-parse.

## Imports

```tsx
// Server Components, client components, anywhere React is available
import { renderRichText, type TagNames, type RichTextRenderers } from "next-typed-intl/rich";
```

The entry exports exactly three things:

| Export | Kind | Purpose |
|---|---|---|
| `renderRichText` | function | Render a tagged template with per-tag renderers |
| `TagNames<T>` | type | Tag names present in a template, extracted at compile time |
| `RichTextRenderers<T>` | type | Renderer map type — one renderer per tag in `T` |

```tsx
// Client code via the react entry (same function, re-exported)
import { renderRichText } from "next-typed-intl/react";
```

## `renderRichText`

```tsx
function renderRichText<T extends string, TRenderers extends AnyRenderers>(
  template: T,
  renderers: TRenderers & MissingRenderers<T, TRenderers>
): ReactNode;
```

Renders `template` by replacing each `<tag>…</tag>` with the node returned by that tag's renderer. Renderers receive the already-rendered inner chunks and return the node to place at that position:

```tsx
import { renderRichText } from "next-typed-intl/rich";

renderRichText("By continuing you accept the <link>terms</link>.", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
});
```

```tsx
// With nested tags and interleaved text
renderRichText(messages.caption, {
  b: (chunks) => <strong>{chunks}</strong>,
  link: (chunks) => <a href="/docs">{chunks}</a>,
});
```

Behavior:

- **Complete by construction** — omit a renderer for a tag present in the template and the call site fails to compile. TypeScript names the missing tag, because the second parameter's type demands exactly the missing keys.
- **Nesting, interleaved text, self-closing tags** — `<icon/>` is supported; its renderer receives `null` as `chunks` since there is no inner content. Hyphenated tag names (`<my-icon>`) are valid.
- **Literal `<`** — a `<` that cannot start a tag (e.g. `"5 < 10"`, `"a </3 b"`) is treated as literal text and renders as-is. A `<` followed by a letter that forms a malformed tag still throws.
- **Fail-fast** — unbalanced, mismatched, or unclosed tags throw `I18nError` with code `MALFORMED_RICH_TEXT`, naming the offending tag. A renderer missing at runtime (possible only if the map is cast or built dynamically) throws the same code.
- **Memoized parsing** — parse results are keyed by the raw template string and shared read-only across renders, so every render of every subscriber does not re-parse the template. The cache holds up to 500 templates and clears and refills on reaching the cap.
- **No keys needed** — output is folded into nested fragments rather than an array, so React never asks for `key` props; chunk order is fixed by the template.

## `TagNames<T>`

Extracts the tag names present in a rich-text template at compile time:

```tsx
type Tags = TagNames<"Click <b>here</b> or <i>there</i>">; // "b" | "i"
```

Self-closing tags (`<icon/>`) contribute their name. A `<` that is not a tag opener contributes nothing. The type mirrors the runtime grammar `[a-zA-Z][a-zA-Z0-9-]*`, so `<my-icon>` is accepted and `<3` is not.

## `RichTextRenderers<T>`

The renderer map type, keyed by `TagNames<T>`:

```tsx
type RichTextRenderers<T extends string> = Record<TagNames<T>, (chunks: ReactNode) => ReactNode>;
```

Each renderer receives the already-rendered inner chunks (a `ReactNode`) and returns the node to place at that tag's position. `renderRichText` uses this type, plus a complementary check that resolves to a record demanding exactly the missing keys — turning an incomplete renderer map into a compile error that names the missing tags.

You rarely need to write the type yourself; it is useful when extracting renderers into a shared object or a helper function:

```tsx
import type { RichTextRenderers } from "next-typed-intl/rich";

const captionRenderers: RichTextRenderers<"Read the <b>full</b> <link>docs</link>"> = {
  b: (chunks) => <strong>{chunks}</strong>,
  link: (chunks) => <a href="/docs">{chunks}</a>,
};
```

## RSC safety

`src/rich/**` carries no `client-only` or `server-only` guard — that is what makes rich text renderable from Server Components, client components, and anything in between. The same invariant is enforced by the build: the entry must stay guard-free. For client code the function is also available through `next-typed-intl/react`, which re-exports it.

## Errors

All runtime failures throw `I18nError` with code `MALFORMED_RICH_TEXT` and a message prefixed `next-typed-intl [MALFORMED_RICH_TEXT]:`:

| Failure | Message shape |
|---|---|
| Unexpected closing tag with no matching opener | `unexpected closing tag </name> in rich text template` |
| Closing tag does not match the currently open tag | `mismatched closing tag </name> in rich text template, expected </open>` |
| Tag opened but never closed | `unclosed tag <name> in rich text template` |
| `<` followed by a letter but not a valid tag | `malformed tag "…" in rich text template (tags look like <b>...</b>)` |
| No renderer for a tag present in the template | `no renderer provided for <name> in rich text template` |

## Related

- [Rich text guide](../guides/rich-text.md) — usage patterns and worked examples.
- [Errors reference](./errors.md) — every `I18nErrorCode` and how to branch on them.
- [Core reference](./core.md) — `I18nError` definition and the `interpolate` API used alongside rich text.
