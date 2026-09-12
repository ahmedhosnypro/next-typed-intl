/**
 * Testing helpers — import from `next-typed-intl/testing` in test suites.
 * Locales that drift out of sync (missing keys, wrong value kinds) are a
 * runtime hazard the compiler already prevents for statically-typed
 * `createI18n` calls; these helpers cover dynamic/partial payloads.
 */

import { I18nError } from "../core/errors";

type MessageLeaf = string | ((...args: never[]) => string);
type MessageTree = { [key: string]: MessageLeaf | MessageTree };

export interface ParityMismatch {
  /** Dot path, e.g. "auth.errors.invalidCredentials". */
  readonly path: string;
  /** Kind of the reference value, or `"missing"` if the path exists only in the candidate (extra key). */
  readonly referenceKind: string;
  /** Kind of the candidate value, or `"missing"` if the path is absent from the candidate. */
  readonly candidateKind: string;
}

/** Options for {@link getParityMismatches} and {@link assertLocaleParity}. */
export interface ParityOptions {
  /**
   * When `true`, keys present in the candidate but absent from the reference
   * are tolerated. Defaults to `false` (strict): extra keys are reported with
   * `referenceKind: "missing"`, because a candidate-only key usually means
   * stale messages that were removed from (or renamed in) the reference.
   */
  readonly allowExtraKeys?: boolean;
}

/**
 * The error thrown by {@link assertLocaleParity}: an {@link I18nError} with
 * code `LOCALE_PARITY_MISMATCH`, carrying the full mismatch list so a test
 * harness can report or snapshot it without re-running the diff.
 */
export interface LocaleParityError extends I18nError {
  /** Every mismatch that failed the check, in traversal (path) order. */
  readonly mismatches: readonly ParityMismatch[];
}

function kindOf(value: unknown): string {
  if (typeof value === "string") return "string";
  if (typeof value === "function") return "function";
  if (value !== null && typeof value === "object") return "object";
  return typeof value;
}

function walk(
  reference: MessageTree,
  candidate: unknown,
  path: string[],
  out: ParityMismatch[],
  allowExtraKeys: boolean
): void {
  if (candidate === null || typeof candidate !== "object") {
    out.push({ path: path.join("."), referenceKind: "object", candidateKind: kindOf(candidate) });
    return;
  }
  const candidateTree = candidate as Record<string, unknown>;
  // Reference-driven pass: missing keys and kind mismatches.
  for (const key of Object.keys(reference)) {
    const refValue = reference[key];
    const candValue = candidateTree[key];
    const refKind = kindOf(refValue);
    const candKind = kindOf(candValue);
    if (candValue === undefined || refKind !== candKind) {
      out.push({
        path: [...path, key].join("."),
        referenceKind: refKind,
        candidateKind: candValue === undefined ? "missing" : candKind,
      });
    } else if (refKind === "object") {
      walk(refValue as MessageTree, candValue, [...path, key], out, allowExtraKeys);
    }
  }
  // Candidate-driven pass: keys the reference does not declare. Reported at
  // the diverging key only (mirroring the reference pass, which stops at the
  // first mismatch on a path) — an extra subtree is one mismatch, not many.
  if (!allowExtraKeys) {
    for (const key of Object.keys(candidateTree)) {
      if (!(key in reference)) {
        out.push({
          path: [...path, key].join("."),
          referenceKind: "missing",
          candidateKind: kindOf(candidateTree[key]),
        });
      }
    }
  }
}

/**
 * Structural diff of two message trees: missing keys, kind mismatches, and
 * (unless `options.allowExtraKeys`) candidate-only extra keys. The check is
 * bidirectional by default — both locales drifting apart in either direction
 * is reported.
 */
export function getParityMismatches(reference: unknown, candidate: unknown, options?: ParityOptions): ParityMismatch[] {
  const out: ParityMismatch[] = [];
  if (reference !== null && typeof reference === "object") {
    walk(reference as MessageTree, candidate, [], out, options?.allowExtraKeys === true);
  }
  return out;
}

/**
 * Throws a {@link LocaleParityError} with a readable listing when `candidate`
 * does not structurally match `reference`. Intended use inside consumer test
 * suites:
 *
 * ```ts
 * it("ar keeps parity with en", () => {
 *   assertLocaleParity(enMessages, arMessages);
 * });
 * ```
 *
 * The thrown value is an {@link I18nError} with `code: "LOCALE_PARITY_MISMATCH"`
 * and the full diff attached as {@link LocaleParityError.mismatches}.
 */
export function assertLocaleParity(reference: unknown, candidate: unknown, options?: ParityOptions): void {
  const mismatches = getParityMismatches(reference, candidate, options);
  if (mismatches.length > 0) {
    const listing = mismatches
      .map((m) => `  - ${m.path}: expected ${m.referenceKind}, got ${m.candidateKind}`)
      .join("\n");
    const error: LocaleParityError = Object.assign(
      new I18nError(
        "LOCALE_PARITY_MISMATCH",
        `Locale parity check failed (${mismatches.length} mismatch(es)):\n${listing}`
      ),
      { mismatches }
    );
    throw error;
  }
}
