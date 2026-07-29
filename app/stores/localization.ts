import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  defaultLocale,
  isLocaleCode,
  localeOptions,
  messages,
  type LocaleCode,
  type MessageKey,
} from "~/locales/messages";

const LOCALE_STORAGE_KEY = "spf_locale";

type TranslationParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : `{${key}}`,
  );
}

function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === "undefined") return defaultLocale;
  const language = navigator.language.split("-")[0] || "";
  return isLocaleCode(language) ? language : defaultLocale;
}

function syncDocumentLanguage(locale: LocaleCode) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export const useLocalizationStore = defineStore("localization", () => {
  const locale = ref<LocaleCode>(defaultLocale);
  const isInitialized = ref(false);

  const currentLocale = computed(() => locale.value);
  const availableLocales = computed(() => localeOptions);

  function initialize() {
    if (isInitialized.value) return;

    if (typeof window !== "undefined") {
      const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      locale.value =
        storedLocale && isLocaleCode(storedLocale)
          ? storedLocale
          : detectBrowserLocale();
      syncDocumentLanguage(locale.value);
    }

    isInitialized.value = true;
  }

  function setLocale(nextLocale: LocaleCode) {
    locale.value = nextLocale;

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      syncDocumentLanguage(nextLocale);
    }
  }

  function t(key: MessageKey, params?: TranslationParams) {
    const template =
      messages[locale.value]?.[key] || messages[defaultLocale][key] || key;
    return interpolate(template, params);
  }

  return {
    locale,
    currentLocale,
    availableLocales,
    isInitialized,
    initialize,
    setLocale,
    t,
  };
});
