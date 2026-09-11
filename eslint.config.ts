import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".coverage/", "dist/", "github-contributions-shade/*.min.js"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Config files run in Node; sources and tests run in the browser.
    files: ["*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.mocha,
      },
    },
    rules: {
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
    },
  },
);
