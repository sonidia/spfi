import { useLocalizationStore } from "~/stores/localization";

export default defineNuxtPlugin((nuxtApp) => {
  const localization = useLocalizationStore();
  // localStorage is unavailable to SSR. Initialize after hydration so the
  // server's default locale and the first client render always match.
  nuxtApp.hook("page:finish", () => localization.initialize());
});
