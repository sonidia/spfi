import { storeToRefs } from "pinia";
import { useThemeStore } from "~/stores/theme";

export function useTheme() {
  const themeStore = useThemeStore();
  const { isDark, theme } = storeToRefs(themeStore);

  if (import.meta.client) {
    themeStore.initialize();
  }

  return {
    isDark,
    theme,
    setTheme: themeStore.setTheme,
    toggleTheme: themeStore.toggleTheme,
  };
}
