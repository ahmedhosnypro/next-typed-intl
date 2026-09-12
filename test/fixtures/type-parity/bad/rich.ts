import { renderRichText } from "../../../../src/react";

// Intentionally invalid: the renderer for <i> is missing. Must NOT compile.
export const brokenLink = renderRichText("By continuing you accept the <b>terms</b> and <i>privacy policy</i>", {
  b: (chunks) => chunks,
});
