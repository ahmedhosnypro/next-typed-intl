import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/index.ts",
    "src/react/index.ts",
    "src/server/index.ts",
    "src/next/index.ts",
    "src/testing/index.ts",
    "src/rich/index.tsx",
    "scripts/*.ts",
    "test/**/*.test.{ts,tsx}",
  ],
  project: ["src/**", "scripts/**", "test/**"],
  // Type-parity fixtures are compiled by their own fixture tsconfigs,
  // invoked from test/type-parity.test.ts — intentionally outside the import graph.
  ignore: ["test/fixtures/type-parity/**"],
  // `createLocaleMiddleware` is a public, deprecated alias of
  // `createLocaleProxy` (kept so existing consumers keep type-checking), so the
  // duplicate-export finding on src/next/index.ts is not a defect.
  ignoreIssues: {
    "src/next/index.ts": ["duplicates"],
  },
};

export default config;
