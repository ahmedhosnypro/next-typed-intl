import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "examples/**", "node_modules/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Library runtime code stays silent; errors are thrown, not logged.
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**/*.ts", "test/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
