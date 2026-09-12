/**
 * Machine-readable error codes carried by {@link I18nError}. Mirrors the
 * ecosystem norm of attaching a stable `code` (Node's `err.code`,
 * next-intl's `IntlError`), so consumers can branch on the failure kind
 * instead of matching message text.
 */
export type I18nErrorCode =
  /** The factory config is structurally invalid (no locales, duplicates, unknown default). */
  | "INVALID_CONFIG"
  /** Messages for the resolved locale are absent or not an object. */
  | "MISSING_MESSAGES"
  /** `defineNamespace` was called with an empty/non-string id. */
  | "INVALID_NAMESPACE_ID"
  /** A namespace id was registered twice on the same instance. */
  | "DUPLICATE_NAMESPACE"
  /** A namespace handle unknown to the instance was read or loaded. */
  | "UNKNOWN_NAMESPACE"
  /** A namespace loader is missing for a locale. */
  | "MISSING_LOADER"
  /** One or more `{placeholders}` in a template had no matching value. */
  | "MISSING_PLACEHOLDER"
  /** A locale value is not one of the configured locales. */
  | "INVALID_LOCALE"
  /** A rich-text string could not be parsed. */
  | "MALFORMED_RICH_TEXT"
  /** A testing-time locale parity check found mismatches. */
  | "LOCALE_PARITY_MISMATCH";

/**
 * Error thrown by all `next-typed-intl` runtime checks.
 *
 * The message is prefixed as `next-typed-intl [CODE]: <human message>` and
 * the same code is available on {@link I18nError.code} for programmatic
 * handling:
 *
 * ```ts
 * try {
 *   i18n.getMessages();
 * } catch (error) {
 *   if (error instanceof I18nError && error.code === "MISSING_MESSAGES") { ... }
 * }
 * ```
 */
export class I18nError extends Error {
  /** Machine-readable failure kind; stable across releases. */
  readonly code: I18nErrorCode;

  constructor(code: I18nErrorCode, message: string) {
    super(`next-typed-intl [${code}]: ${message}`);
    this.name = "I18nError";
    this.code = code;
  }
}
