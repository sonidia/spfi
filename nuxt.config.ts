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
  runtimeConfig: {
    tracktacoApiKey: "",
    public: {
      tracktacoBaseUrl: "",
      quanLySheetUrl: process.env.NUXT_PUBLIC_QUAN_LY_SHEET_URL || "",
      fbsSheetUrl: process.env.NUXT_PUBLIC_FBS_SHEET_URL || "",
      buff1SheetUrl: process.env.NUXT_PUBLIC_BUFF1_SHEET_URL || "",
      buff2SheetUrl: process.env.NUXT_PUBLIC_BUFF2_SHEET_URL || "",
      machine1SheetUrl: process.env.NUXT_PUBLIC_MACHINE_1_SHEET_URL || "",
      machine2SheetUrl: process.env.NUXT_PUBLIC_MACHINE_2_SHEET_URL || "",
      machine3SheetUrl: process.env.NUXT_PUBLIC_MACHINE_3_SHEET_URL || "",
      machine4SheetUrl: process.env.NUXT_PUBLIC_MACHINE_4_SHEET_URL || "",
      machine5SheetUrl: process.env.NUXT_PUBLIC_MACHINE_5_SHEET_URL || "",
      machine6SheetUrl: process.env.NUXT_PUBLIC_MACHINE_6_SHEET_URL || "",
    },
  },
  // Auto-import utils
  imports: {
    dirs: ["utils/**"],
  },
});
