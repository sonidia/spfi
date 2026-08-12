import { storeToRefs } from "pinia";
import type { MessageKey } from "~/locales/messages";
import { useLocalizationStore } from "~/stores/localization";

type TranslationParams = Record<string, string | number>;

export function useLocalization() {
  const localization = useLocalizationStore();
  const { availableLocales, locale } = storeToRefs(localization);

  if (import.meta.client) {
    localization.initialize();
  }

  return {
    locale,
    availableLocales,
    setLocale: localization.setLocale,
    t: (key: MessageKey, params?: TranslationParams) => localization.t(key, params),
  };
}
