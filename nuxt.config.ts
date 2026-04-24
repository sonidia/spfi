// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
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
        transform(code, id) {
          if (id.includes("papaparse")) {
            // "Hide" typeof window/self from Nitro's find-and-replace by adding parentheses
            return code
              .replace(/typeof window/g, "typeof(window)")
              .replace(/typeof self/g, "typeof(self)");
          }
        },
      },
    ],
  },
});
