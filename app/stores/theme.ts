import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "spf_theme";
let systemThemeQuery: MediaQueryList | null = null;

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

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THEME_STORAGE_KEY);
}

export const useThemeStore = defineStore("theme", () => {
  const theme = ref<ThemeMode>("light");
  const isInitialized = ref(false);

  const isDark = computed(() => theme.value === "dark");

  function initialize() {
    if (isInitialized.value) return;

    if (typeof window !== "undefined") {
      const storedTheme = getStoredTheme();
      theme.value = isThemeMode(storedTheme) ? storedTheme : getPreferredTheme();
      applyTheme(theme.value);
      watchSystemTheme();
    }

    isInitialized.value = true;
  }

  function watchSystemTheme() {
    if (systemThemeQuery || typeof window === "undefined") return;
    systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncSystemTheme = () => {
      if (isThemeMode(getStoredTheme())) return;
      theme.value = getPreferredTheme();
      applyTheme(theme.value);
    };

    systemThemeQuery.addEventListener("change", syncSystemTheme);
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
