import { useThemeStore } from "~/stores/theme";

export default defineNuxtPlugin(() => {
  const theme = useThemeStore();
  theme.initialize();
});
