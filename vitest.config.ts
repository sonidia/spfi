import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "#imports": fileURLToPath(
        new URL("./tests/unit/stubs/nuxt-imports.ts", import.meta.url),
      ),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "~~": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts"],
    clearMocks: true,
  },
});
