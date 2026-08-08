// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@pinia/nuxt"],
  runtimeConfig: {
    // Production is fail-closed unless a Basic Auth password is configured.
    // Development remains local-first unless a password is explicitly set.
    appAuthRequired: process.env.NODE_ENV === "production",
    appAuthUsername: "admin",
    appAuthPassword: "",
    allowedOrigins: "",
    debugProxyEnabled: process.env.NODE_ENV !== "production",
    debugProxyAllowedHosts: "httpbin.org,api.ipify.org",
    // Disabled by default so Shopify's app/store-specific throttle remains the
    // source of truth. Deployments can opt in through matching NUXT_* env vars.
    apiRateLimitPerMinute: 0,
    tokenRateLimitPerMinute: 0,
  },
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
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit", "@lucide/vue"],
    },
  },
  // Auto-import utils
  imports: {
    dirs: ["utils/**"],
  },
});
