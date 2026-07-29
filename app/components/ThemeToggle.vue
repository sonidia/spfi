<script setup lang="ts">
const { isDark, toggleTheme } = useTheme();
const { t } = useLocalization();
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggleTheme"
  >
    <span class="theme-track" :class="{ active: isDark }" aria-hidden="true">
      <span class="theme-thumb" />
    </span>
    <!-- <span class="theme-label">
      {{ isDark ? t("theme.dark") : t("theme.light") }}
    </span> -->
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  padding: 0 10px;
  box-shadow: 0 10px 24px rgba(20, 34, 27, 0.06);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.theme-toggle:hover {
  border-color: rgba(31, 122, 77, 0.38);
  background: var(--surface-soft);
}

.theme-track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--blue-soft);
  box-shadow: inset 0 0 0 1px rgba(39, 92, 145, 0.18);
  transition: background 0.18s ease;
}

.theme-track.active {
  background: var(--green-soft);
}

.theme-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--blue);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.theme-track.active .theme-thumb {
  background: var(--green);
  transform: translateX(14px);
}

.theme-label {
  min-width: 34px;
  text-align: left;
}

.theme-toggle:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}
</style>
