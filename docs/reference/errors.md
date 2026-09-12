# Errors

Every runtime check in `next-typed-intl` throws a single error class, `I18nError`, exported from the root entry (`next-typed-intl`). It extends `Error` and carries a machine-readable `.code` so consumers can branch on the failure kind instead of matching message text — the same pattern as Node's `err.code` or next-intl's `IntlError`. The message is always prefixed as `next-typed-intl [CODE]: <human message>`, and `name` is set to `"I18nError"`.

The type of `.code` is `I18nErrorCode` (also exported from the root entry), a union of ten stable string literals. Codes are stable across releases; the human-readable message is not.

```ts
import { I18nError } from "next-typed-intl";

try {
  i18n.getMessages();
} catch (error) {
  if (error instanceof I18nError && error.code === "MISSING_MESSAGES") {
    // handle the missing messages case
  }
}
```

The `instanceof` check matters: because the library ships multiple bundles (`next-typed-intl` and `next-typed-intl/react`, for example), a plain `error.code` read on a foreign error would be fragile, and the build pipeline verifies that an `I18nError` thrown from any subpath bundle is still an `instanceof` the root entry's class. Programmatic handling should always combine `instanceof I18nError` with a `.code` comparison, as above.

## Code table

| Code | Raised when | Owned guide |
|---|---|---|
| `INVALID_CONFIG` | The factory config is structurally invalid: `locales` is empty or contains non-string / invalid BCP-47 tags, locales are duplicated (compared case-insensitively), `defaultLocale` is not a string or not listed in `locales`. Also thrown by `useI18n` when no `<I18nProvider>` is found above the component. | [Messages](../guides/messages.md) |
| `MISSING_MESSAGES` | The messages entry for the resolved locale is absent or not an object — either at factory time (no messages object for the default locale) or when reading messages for a locale at runtime. | [Messages](../guides/messages.md) |
| `INVALID_NAMESPACE_ID` | `defineNamespace` was called with an empty or non-string id. | [Messages](../guides/messages.md) |
| `DUPLICATE_NAMESPACE` | A namespace id was registered twice on the same instance. | [Messages](../guides/messages.md) |
| `UNKNOWN_NAMESPACE` | A namespace handle unknown to the instance was read or loaded (e.g. a handle created by a different `createI18n` instance). | [Messages](../guides/messages.md) |
| `MISSING_LOADER` | A namespace was defined without a loader for one of the instance's locales. | [Messages](../guides/messages.md) |
| `MISSING_PLACEHOLDER` | `interpolate` was given a template whose `{placeholders}` have no matching values in the values object; the message lists every missing placeholder. | [Interpolation](../guides/interpolation.md) |
| `INVALID_LOCALE` | A locale value that is not one of the configured locales was used — e.g. by `setRequestLocale` (server) or `I18nProvider` (react). Typed call sites get a compile error instead; this guards untyped ones. | [Static rendering](../guides/static-rendering.md) |
| `MALFORMED_RICH_TEXT` | A rich-text string could not be parsed: unmatched or out-of-order closing tags, unclosed tags, or a tag with no renderer provided. | [Rich text](../guides/rich-text.md) |
| `LOCALE_PARITY_MISMATCH` | `assertLocaleParity` found structural drift between a reference locale's messages and a candidate's; the thrown error also carries the full diff as `.mismatches` (see below). | [Testing](../guides/testing.md) |

## Which entry exports what

- `I18nError` and the `I18nErrorCode` type are exported **only** from the root entry, `next-typed-intl`. Every other entry re-uses the same class — errors thrown from `next-typed-intl/server`, `next-typed-intl/react`, `next-typed-intl/rich`, or `next-typed-intl/testing` are all instances of it.
- The `LOCALE_PARITY_MISMATCH` error additionally satisfies the `LocaleParityError` interface exported from `next-typed-intl/testing`, which narrows `.code` and adds the `.mismatches: ParityMismatch[]` diff. Import that type from `next-typed-intl/testing` if you want typed access to the diff:

```ts
import { assertLocaleParity } from "next-typed-intl/testing";
import type { LocaleParityError } from "next-typed-intl/testing";

try {
  assertLocaleParity(enMessages, arMessages);
} catch (error) {
  if (error instanceof I18nError && error.code === "LOCALE_PARITY_MISMATCH") {
    const parityError = error as LocaleParityError;
    for (const mismatch of parityError.mismatches) {
      // mismatch.path, mismatch.referenceKind, mismatch.candidateKind
    }
  }
}
```

## Catching and rethrowing

Because all failures funnel through one class, a single catch block can normalize library errors for logging or user-facing reporting, while anything else is treated as an unexpected internal error:

```ts
import { I18nError, type I18nErrorCode } from "next-typed-intl";

function describe(error: unknown): string | undefined {
  if (!(error instanceof I18nError)) return undefined;
  const code: I18nErrorCode = error.code;
  return `${code}: ${error.message}`;
}
```

Errors are thrown, never logged: the library contains no `console.*` calls, so silent failure is not part of its contract. If a check would fail, it fails loudly at the call site.

## Related pages

- Entry reference for the root API: [Core](./core.md)
- Namespace machinery (`defineNamespace`, loaders, seeding): [Messages](../guides/messages.md)
- Parity checking: [Testing](../guides/testing.md) and [Testing reference](./testing.md)
- Rich text parsing and renderers: [Rich text](../guides/rich-text.md) and [Rich reference](./rich.md)
