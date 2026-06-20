// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@pinia/nuxt"],
  nitro: {
    externals: {
      external: ["papaparse"],
    },
  },
  vite: {
    plugins: [
      {
        name: "fix-papaparse",
        transform(code: string, id: string | string[]) {
          if (id.includes("papaparse")) {
            return code
              .replace(/typeof window/g, "typeof(window)")
              .replace(/typeof self/g, "typeof(self)");
          }
        },
      },
    ],
  },
  // Auto-import utils
  imports: {
    dirs: ["utils/**"],
  },
});
