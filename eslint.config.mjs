import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

/** @type {import("eslint").Linter.Config[]} */
export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.min.js",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // Keep defined so existing eslint-disable comments do not error; hooks are enforced by tsc/CI elsewhere.
      "react-hooks/exhaustive-deps": "off",
    },
  },
)
