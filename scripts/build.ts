/**
 * Deterministic build: ONE tsup invocation with a single config object whose
 * entries cover all six subpath exports. This is NOT a config array — a config
 * array spins up parallel DTS workers that race and intermittently drop
 * dist/react/index.d.ts; a single object with multiple entries shares one
 * pipeline and one DTS worker.
 *
 * Post-build steps:
 *  1. Prepend `"use client";` to dist/react/index.js. esbuild drops the
 *     directive when bundling, Next.js requires it on the resolved entry
 *     file, and tsup's treeshake pass strips a config-level banner — so we
 *     prepend to the emitted file directly (no banner option needed).
 *  2. Verify class identity across entry bundles. The react bundle never
 *     re-exports I18nError, so import ./dist/index.js and trigger a throw from
 *     the react bundle (malformed rich text), then assert the thrown error is
 *     an instanceof the ROOT entry's I18nError. If bundling ever emits two
 *     copies of the class, instanceof breaks for consumers crossing the entry
 *     boundary — fail the build instead of shipping that.
 */

import { readFile, writeFile } from "node:fs/promises";
import { build, type Options } from "tsup";

const options: Options = {
  clean: true,
  format: ["esm"],
  dts: {
    // rollup-plugin-dts injects baseUrl internally; the TS6 API (which tsup
    // uses while TS7 is API-less) hard-errors on deprecated options without this.
    compilerOptions: { ignoreDeprecations: "6.0" },
  },
  treeshake: true,
  external: ["react", "react-dom", "next", "server-only", "client-only", "negotiator", "@formatjs/intl-localematcher"],
  outExtension: () => ({ js: ".js" }),
};

await build({
  ...options,
  entry: {
    index: "src/index.ts",
    "server/index": "src/server/index.ts",
    "next/index": "src/next/index.ts",
    "testing/index": "src/testing/index.ts",
    "rich/index": "src/rich/index.tsx",
    "react/index": "src/react/index.ts",
  },
});

const reactBundlePath = "dist/react/index.js";
const reactBundle = await readFile(reactBundlePath, "utf8");
await writeFile(reactBundlePath, `"use client";\n${reactBundle}`);

const { I18nError } = await import("../dist/index.js");
const { renderRichText } = await import("../dist/react/index.js");
let thrown: unknown;
try {
  // `as string` widens past the literal-template renderer-completeness check —
  // this probe is about cross-entry class identity via a runtime throw.
  renderRichText("<b>unclosed" as string, {});
} catch (error) {
  thrown = error;
}
if (!(thrown instanceof I18nError)) {
  console.error(
    "Build check failed: an error thrown by dist/react/index.js is not an instanceof the dist/index.js " +
      "I18nError. `instanceof I18nError` would break for consumers crossing entry boundaries — the bundles " +
      "ship duplicated copies of the class."
  );
  process.exit(1);
}
