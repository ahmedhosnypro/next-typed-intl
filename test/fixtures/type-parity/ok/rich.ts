import { renderRichText } from "../../../../src/react";

export const termsLink = renderRichText("By continuing you accept the <b>terms</b> and <i>privacy policy</i>", {
  b: (chunks) => chunks,
  i: (chunks) => chunks,
});
