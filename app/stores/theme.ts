import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "spf_theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const useThemeStore = defineStore("theme", () => {
  const theme = ref<ThemeMode>("light");
  const isInitialized = ref(false);

  const isDark = computed(() => theme.value === "dark");

  function initialize() {
    if (isInitialized.value) return;

    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      theme.value = isThemeMode(storedTheme) ? storedTheme : getPreferredTheme();
      applyTheme(theme.value);
    }

    isInitialized.value = true;
  }

  function setTheme(nextTheme: ThemeMode) {
    theme.value = nextTheme;

    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      applyTheme(nextTheme);
    }
  }

  function toggleTheme() {
    setTheme(isDark.value ? "light" : "dark");
  }

  return {
    theme,
    isDark,
    isInitialized,
    initialize,
    setTheme,
    toggleTheme,
  };
});
