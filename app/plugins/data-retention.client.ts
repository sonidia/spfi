import { useDataRetentionStore } from "~/stores/dataRetention";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    useDataRetentionStore().initialize();
  });
});
