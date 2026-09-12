import { describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";

import { renderRichText as renderRichTextFromReactEntry } from "../src/react/index";
import { type RichTextRenderers, renderRichText } from "../src/rich/index";

function render(node: ReactNode): string {
  return renderToString(node);
}

describe("renderRichText", () => {
  it("is re-exported from the react entry as the same function reference", () => {
    expect(renderRichTextFromReactEntry).toBe(renderRichText);
  });

  it("passes plain text through unchanged", () => {
    expect(render(renderRichText("Just text", {}))).toBe("Just text");
  });

  it("renders a single tag through its renderer", () => {
    const node = renderRichText("Click <b>here</b> now", { b: (chunks) => <strong>{chunks}</strong> });
    expect(render(node)).toBe("Click <strong>here</strong> now");
  });

  it("supports nested tags, rendering inner chunks first", () => {
    const order: string[] = [];
    const node = renderRichText("<b>a<i>b</i>c</b>", {
      b: (chunks) => {
        order.push("b");
        return <b>{chunks}</b>;
      },
      i: (chunks) => {
        order.push("i");
        return <i>{chunks}</i>;
      },
    });
    expect(render(node)).toBe("<b>a<i>b</i>c</b>");
    expect(order).toEqual(["i", "b"]);
  });

  it("preserves text/tag interleaving", () => {
    const node = renderRichText("x<b>y</b>z<i>w</i>!", {
      b: (chunks) => <b>{chunks}</b>,
      i: (chunks) => <i>{chunks}</i>,
    });
    expect(render(node)).toBe("x<b>y</b>z<i>w</i>!");
  });

  it("hands each renderer its rendered inner chunks", () => {
    let received: ReactNode = null;
    renderRichText("<b>a<i>c</i>d</b>", {
      b: (chunks) => {
        received = chunks;
        return chunks;
      },
      i: (chunks) => <mark>{chunks}</mark>,
    });
    expect(render(received)).toBe("a<mark>c</mark>d");
  });

  it("throws on an unclosed tag", () => {
    expect(() => renderRichText("<b>oops", { b: (chunks) => chunks })).toThrow(
      "next-typed-intl [MALFORMED_RICH_TEXT]: unclosed tag <b> in rich text template"
    );
  });

  it("throws on a stray closing tag", () => {
    expect(() => renderRichText("done</b>", {})).toThrow(
      "next-typed-intl [MALFORMED_RICH_TEXT]: unexpected closing tag </b> in rich text template"
    );
  });

  it("throws on mismatched open/close pairs", () => {
    expect(() => renderRichText("<b>x</i>", { b: (chunks) => chunks })).toThrow(
      /next-typed-intl \[MALFORMED_RICH_TEXT\]: mismatched closing tag <\/i>/
    );
  });

  it("throws on malformed tag syntax", () => {
    expect(() => renderRichText("a <b c", {})).toThrow(/next-typed-intl \[MALFORMED_RICH_TEXT\]: malformed tag/);
  });

  it("renders a literal '<' that cannot start a tag", () => {
    expect(render(renderRichText("5 < 10", {}))).toBe("5 &lt; 10");
    expect(render(renderRichText("a </3 b", {}))).toBe("a &lt;/3 b");
  });

  it("renders self-closing tags, passing null as chunks", () => {
    let received: ReactNode = "unset";
    const node = renderRichText("a<icon/>b", {
      icon: (chunks) => {
        received = chunks;
        return <span>icon</span>;
      },
    });
    expect(render(node)).toBe("a<span>icon</span>b");
    expect(received).toBeNull();
  });

  it("supports hyphenated tag names", () => {
    const node = renderRichText("open <my-icon>x</my-icon> close", {
      "my-icon": (chunks) => <strong>{chunks}</strong>,
    });
    expect(render(node)).toBe("open <strong>x</strong> close");
  });

  it("extracts hyphenated and self-closing names, skipping literal '<', at the type level", () => {
    // Fails to compile if TagNames extraction regresses (checked by tsc).
    const hyphenated: RichTextRenderers<"go <my-link>there</my-link> now"> = {
      "my-link": (chunks) => chunks,
    };
    const selfClosing: RichTextRenderers<"a <icon/> b"> = { icon: (chunks) => chunks };
    const literalAngle: RichTextRenderers<"5 < 10 and <b>yes</b>"> = { b: (chunks) => chunks };
    expect(Object.keys(hyphenated)).toEqual(["my-link"]);
    expect(Object.keys(selfClosing)).toEqual(["icon"]);
    expect(Object.keys(literalAngle)).toEqual(["b"]);
  });

  it("throws when a renderer is missing at runtime", () => {
    const renderers = {} as RichTextRenderers<"<b>x</b>">;
    expect(() => renderRichText("<b>x</b>", renderers)).toThrow(
      "next-typed-intl [MALFORMED_RICH_TEXT]: no renderer provided for <b> in rich text template"
    );
  });
});
