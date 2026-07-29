import { useLocalizationStore } from "~/stores/localization";

export default defineNuxtPlugin(() => {
  const localization = useLocalizationStore();
  localization.initialize();
});
