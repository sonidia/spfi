import enMessages from "./packs/en.ts";

export type LocaleCode = "en" | "vi" | "es" | "zh" | "ja" | "ar";
export type MessageKey = keyof typeof enMessages;
export type LocaleMessages = Partial<Record<MessageKey, string>>;
export type LocaleCoverage = "complete" | "partial";

export const defaultLocale: LocaleCode = "en";
export const defaultMessages: Record<MessageKey, string> = enMessages;

export const localeOptions: Array<{
  code: LocaleCode;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  flagCode: string;
  coverage: LocaleCoverage;
  direction: "ltr" | "rtl";
}> = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    shortLabel: "EN",
    flagCode: "US",
    coverage: "complete",
    direction: "ltr",
  },
  {
    code: "vi",
    label: "Vietnamese",
    nativeLabel: "Tiếng Việt",
    shortLabel: "VI",
    flagCode: "VN",
    coverage: "complete",
    direction: "ltr",
  },
  {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    shortLabel: "ES",
    flagCode: "ES",
    coverage: "partial",
    direction: "ltr",
  },
  {
    code: "zh",
    label: "Chinese",
    nativeLabel: "中文",
    shortLabel: "ZH",
    flagCode: "CN",
    coverage: "partial",
    direction: "ltr",
  },
  {
    code: "ja",
    label: "Japanese",
    nativeLabel: "日本語",
    shortLabel: "JA",
    flagCode: "JP",
    coverage: "partial",
    direction: "ltr",
  },
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    shortLabel: "AR",
    flagCode: "SA",
    coverage: "partial",
    direction: "rtl",
  },
];

const localeLoaders: Record<LocaleCode, () => Promise<LocaleMessages>> = {
  en: async () => defaultMessages,
  vi: async () => (await import("./packs/vi.ts")).default,
  es: async () => (await import("./packs/es.ts")).default,
  zh: async () => (await import("./packs/zh.ts")).default,
  ja: async () => (await import("./packs/ja.ts")).default,
  ar: async () => (await import("./packs/ar.ts")).default,
};

export function loadLocaleMessages(locale: LocaleCode) {
  return localeLoaders[locale]();
}

export function isLocaleCode(value: string): value is LocaleCode {
  return localeOptions.some((option) => option.code === value);
}

export function getLocaleDirection(locale: LocaleCode): "ltr" | "rtl" {
  return localeOptions.find((option) => option.code === locale)?.direction || "ltr";
}
