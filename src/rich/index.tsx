import type { ReactNode } from "react";
import { I18nError } from "../core/errors";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** Case differs under Uppercase/Lowercase only for cased letters. */
type IsLetter<C extends string> = Uppercase<C> extends Lowercase<C> ? false : true;

type IsTagNameTail<S extends string> = S extends ""
  ? true
  : S extends `${infer Head}${infer Tail}`
    ? Head extends Digit | "-"
      ? IsTagNameTail<Tail>
      : IsLetter<Head> extends true
        ? IsTagNameTail<Tail>
        : false
    : false;

/** Mirrors the runtime grammar: `[a-zA-Z][a-zA-Z0-9-]*`. */
type IsTagName<S extends string> = S extends ""
  ? false
  : S extends `${infer Head}${infer Tail}`
    ? IsLetter<Head> extends true
      ? IsTagNameTail<Tail>
      : false
    : false;

type TagNamesAtAngle<Rest extends string> = Rest extends `/${infer Name}>${infer After}`
  ? IsTagName<Name> extends true
    ? TagNames<After>
    : TagNames<Rest>
  : Rest extends `${infer Name}/>${infer After}`
    ? IsTagName<Name> extends true
      ? Name | TagNames<After>
      : TagNames<Rest>
    : Rest extends `${infer Name}>${infer After}`
      ? IsTagName<Name> extends true
        ? Name | TagNames<After>
        : TagNames<Rest>
      : TagNames<Rest>;

/**
 * Tag names present in a rich-text template, extracted at compile time:
 * `TagNames<"Click <b>here</b> or <i>there</i>">` is `"b" | "i"`.
 * Self-closing tags (`<icon/>`) contribute their name; a `<` that is not a
 * tag opener (e.g. `"5 < 10"`, `"a </3 b"`) is literal text and contributes
 * nothing. Used to type {@link RichTextRenderers} so a missing renderer is a
 * compile error, not a runtime surprise.
 */
export type TagNames<T extends string> = T extends `${string}<${infer Rest}` ? TagNamesAtAngle<Rest> : never;

/**
 * One renderer per tag in the template. Each receives the already-rendered
 * inner chunks and returns the node to place at that position. The key set
 * is enforced at compile time from the template's literal type.
 */
export type RichTextRenderers<T extends string> = Record<TagNames<T>, (chunks: ReactNode) => ReactNode>;

type AnyRenderers = Record<string, (chunks: ReactNode) => ReactNode>;

/**
 * When `TRenderers` is missing tags the template requires, this resolves to
 * a record demanding exactly those keys, turning an incomplete renderer map
 * into a compile error that names the missing tags.
 */
type MissingRenderers<T extends string, TRenderers> =
  Exclude<TagNames<T>, keyof TRenderers> extends never
    ? unknown
    : Record<Exclude<TagNames<T>, keyof TRenderers>, (chunks: ReactNode) => ReactNode>;

interface ParsedTag {
  readonly name: string;
  readonly children: ParsedChunk[];
}

type ParsedChunk = string | ParsedTag;

interface TagMatch {
  readonly name: string;
  /** Characters consumed, including the angle brackets (and `/` for closers). */
  readonly length: number;
  readonly selfClosing: boolean;
}

function matchTag(rest: string, kind: "open" | "close"): TagMatch | null {
  const pattern = kind === "open" ? /^<([a-zA-Z][a-zA-Z0-9-]*)\/?>/ : /^<\/([a-zA-Z][a-zA-Z0-9-]*)>/;
  const match = pattern.exec(rest);
  const name = match?.[1];
  if (name === undefined || match === null) return null;
  const raw = match[0];
  return { name, length: raw.length, selfClosing: kind === "open" && raw.endsWith("/>") };
}

/**
 * Recursive-descent parser for `<name>...</name>` markup. Strict by design
 * (matches the library's fail-fast philosophy): unbalanced, mismatched, or
 * malformed tags throw rather than silently mangling the output. A `<` that
 * cannot start a tag (not followed by a letter or `/` + letter, e.g. the
 * `<` in `"5 < 10"`) is literal text, not an error.
 */
function parseTemplate(template: string): ParsedChunk[] {
  let index = 0;

  function parseChunks(closingTag: string | null): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    let textStart = index;

    const pushText = (end: number): void => {
      if (end > textStart) chunks.push(template.slice(textStart, end));
    };

    while (index < template.length) {
      if (template[index] !== "<") {
        index += 1;
        continue;
      }
      const rest = template.slice(index);
      const closing = matchTag(rest, "close");
      if (closing) {
        pushText(index);
        index += closing.length;
        if (closingTag === null) {
          throw new I18nError("MALFORMED_RICH_TEXT", `unexpected closing tag </${closing.name}> in rich text template`);
        }
        if (closing.name !== closingTag) {
          throw new I18nError(
            "MALFORMED_RICH_TEXT",
            `mismatched closing tag </${closing.name}> in rich text template, expected </${closingTag}>`
          );
        }
        return chunks;
      }
      const opening = matchTag(rest, "open");
      if (!opening) {
        if (!/^<\/?[a-zA-Z]/.test(rest)) {
          // Not a tag start at all ("5 < 10", "</3"): literal text.
          index += 1;
          continue;
        }
        throw new I18nError(
          "MALFORMED_RICH_TEXT",
          `malformed tag "${rest.slice(0, 12)}" in rich text template (tags look like <b>...</b>)`
        );
      }
      pushText(index);
      index += opening.length;
      chunks.push({
        name: opening.name,
        children: opening.selfClosing ? [] : parseChunks(opening.name),
      });
      textStart = index;
    }

    pushText(index);
    if (closingTag !== null) {
      throw new I18nError("MALFORMED_RICH_TEXT", `unclosed tag <${closingTag}> in rich text template`);
    }
    return chunks;
  }

  return parseChunks(null);
}

/** Bound on parse cache growth: message templates are finite per app, but a
 * pathological caller interpolating unbounded strings would grow forever. */
const PARSE_CACHE_LIMIT = 500;

/**
 * Parse results keyed by raw template string. Templates repeat across renders
 * (every render of every subscriber re-parses otherwise); parse output depends
 * solely on the template, so results are shared read-only. On reaching the cap
 * the cache clears and refills — simple eviction beats LRU bookkeeping here.
 */
const parseCache = new Map<string, ParsedChunk[]>();

function parseTemplateCached(template: string): ParsedChunk[] {
  const cached = parseCache.get(template);
  if (cached !== undefined) return cached;
  const parsed = parseTemplate(template);
  if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.clear();
  parseCache.set(template, parsed);
  return parsed;
}

function renderChunk(chunk: ParsedChunk, renderers: AnyRenderers): ReactNode {
  if (typeof chunk === "string") return chunk;
  const renderer = renderers[chunk.name];
  if (!renderer) {
    throw new I18nError("MALFORMED_RICH_TEXT", `no renderer provided for <${chunk.name}> in rich text template`);
  }
  return renderer(renderChunks(chunk.children, renderers));
}

/**
 * Fold chunks into nested fragments instead of an array, so React never
 * needs keys (chunk order is fixed by the template; nothing reorders here).
 */
function renderChunks(chunks: readonly ParsedChunk[], renderers: AnyRenderers): ReactNode {
  let result: ReactNode = null;
  for (const chunk of chunks) {
    result = (
      <>
        {result}
        {renderChunk(chunk, renderers)}
      </>
    );
  }
  return result;
}

/**
 * Render a rich-text message template with one renderer per tag. Supports
 * nesting, interleaved text, hyphenated tag names (`<my-icon>`), and
 * self-closing tags (`<icon/>`, whose renderer receives `null` as chunks):
 *
 * ```tsx
 * renderRichText(messages.caption, {
 *   b: (chunks) => <strong>{chunks}</strong>,
 *   link: (chunks) => <a href="/docs">{chunks}</a>,
 * });
 * ```
 *
 * A `<` that cannot start a tag (e.g. `"5 < 10"`) renders as literal text.
 * The renderer record is complete by construction — omit a tag present in
 * the template and the call site fails to compile. Malformed markup throws
 * an {@link I18nError} (`MALFORMED_RICH_TEXT`) naming the offending tag.
 */
export function renderRichText<T extends string, TRenderers extends AnyRenderers>(
  template: T,
  renderers: TRenderers & MissingRenderers<T, TRenderers>
): ReactNode {
  return renderChunks(parseTemplateCached(template), renderers);
}
