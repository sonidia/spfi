// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@pinia/nuxt"],
  app: {
    head: {
      script: [
        {
          innerHTML:
            '(function(){try{var key="spf_theme";var stored=localStorage.getItem(key);var theme=stored==="dark"||stored==="light"?stored:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(error){}})();',
        },
      ],
    },
  },
  runtimeConfig: {
    adminApiVersion: "2026-07",
    allowedOrigins: "",
    apiOriginRequired: true,
    allowHostOriginFallback: process.env.NODE_ENV !== "production",
    trustProxyHeaders: false,
    allowPrivateProxyHosts: false,
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
