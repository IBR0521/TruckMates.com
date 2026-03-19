export default [
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
    files: ["**/*.{js,mjs,cjs}"],
    rules: {},
  },
]
