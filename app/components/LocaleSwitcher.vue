<script setup lang="ts">
import type { LocaleCode } from "~/locales/messages";

const { availableLocales, locale, setLocale, t } = useLocalization();

function updateLocale(event: Event) {
  const target = event.target as HTMLSelectElement;
  setLocale(target.value as LocaleCode);
}
</script>

<template>
  <label class="locale-switcher">
    <span class="sr-only">{{ t("nav.language") }}</span>
    <select
      :value="locale"
      :aria-label="t('nav.language')"
      @change="updateLocale"
    >
      <option
        v-for="option in availableLocales"
        :key="option.code"
        :value="option.code"
      >
        {{ option.nativeLabel }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.locale-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.locale-switcher select {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 0 28px 0 10px;
}

.locale-switcher select:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
