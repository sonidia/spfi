<script setup lang="ts">
const { isDark, toggleTheme } = useTheme();
const { t } = useLocalization();
</script>

<template>
  <button
    class="theme-toggle"
    :class="{ 'is-dark': isDark }"
    type="button"
    :aria-label="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    :title="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggleTheme"
  >
    <span class="theme-icon" aria-hidden="true">
      <IconsMoon v-if="isDark" />
      <IconsSun v-else />
    </span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: rgb(255, 153, 0);
  cursor: pointer;
  font: inherit;
  padding: 0;
  box-shadow: 0 10px 24px rgba(20, 34, 27, 0.06);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.theme-toggle:hover {
  border-color: rgba(31, 122, 77, 0.38);
  background: var(--surface-soft);
  transform: translateY(-1px);
}

.theme-toggle.is-dark {
  color: var(--amber);
}

.theme-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}
</style>
