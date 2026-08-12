import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import {
  defaultLocale,
  defaultMessages,
  getLocaleDirection,
  isLocaleCode,
  loadLocaleMessages,
  localeOptions,
  type LocaleCode,
  type LocaleMessages,
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
    const direction = getLocaleDirection(locale);
    document.documentElement.lang = locale;
    // Keep the viewport chrome LTR; app containers opt into RTL explicitly.
    document.documentElement.dir = "ltr";
    delete document.documentElement.dataset.direction;
    document.documentElement.dataset.localeDirection = direction;
    document.body.dir = "ltr";
  }
}

export const useLocalizationStore = defineStore("localization", () => {
  const locale = ref<LocaleCode>(defaultLocale);
  const isInitialized = ref(false);
  const isLoadingLocale = ref(false);
  const loadedMessages = shallowRef<Partial<Record<LocaleCode, LocaleMessages>>>({
    [defaultLocale]: defaultMessages,
  });
  let loadSequence = 0;

  const currentLocale = computed(() => locale.value);
  const availableLocales = computed(() => localeOptions);

  function initialize() {
    if (isInitialized.value) return;

    if (typeof window !== "undefined") {
      const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      const initialLocale =
        storedLocale && isLocaleCode(storedLocale)
          ? storedLocale
          : detectBrowserLocale();
      void setLocale(initialLocale);
    }

    isInitialized.value = true;
  }

  async function setLocale(nextLocale: LocaleCode) {
    const sequence = ++loadSequence;
    locale.value = nextLocale;

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      syncDocumentLanguage(nextLocale);
    }

    if (loadedMessages.value[nextLocale]) return;

    isLoadingLocale.value = true;
    try {
      const messages = await loadLocaleMessages(nextLocale);
      if (sequence !== loadSequence) return;
      loadedMessages.value = {
        ...loadedMessages.value,
        [nextLocale]: messages,
      };
    } catch (error) {
      console.error(`Failed to load locale ${nextLocale}.`, error);
    } finally {
      if (sequence === loadSequence) isLoadingLocale.value = false;
    }
  }

  function t(key: MessageKey, params?: TranslationParams) {
    const template =
      loadedMessages.value[locale.value]?.[key] || defaultMessages[key] || key;
    return interpolate(template, params);
  }

  return {
    locale,
    currentLocale,
    availableLocales,
    isInitialized,
    isLoadingLocale,
    initialize,
    setLocale,
    t,
  };
});
