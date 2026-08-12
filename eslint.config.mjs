import prettier from "eslint-config-prettier";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  prettier,
  {
    ignores: [
      ".nuxt/**",
      ".output/**",
      "dist/**",
      "node_modules/**",
      "wrapper/src-tauri/target/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
      "import/no-duplicates": "off",
      "no-control-regex": "off",
      "no-useless-escape": "off",
      "vue/attribute-hyphenation": "off",
      "vue/attributes-order": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
    },
  },
);
