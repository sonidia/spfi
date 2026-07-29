<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { LocaleCode } from "~/locales/messages";

const { availableLocales, locale, setLocale, t } = useLocalization();
const isOpen = ref(false);
const switcherRef = ref<HTMLElement | null>(null);

const currentLocale = computed(() => locale.value);
const currentOption = computed(
  () =>
    availableLocales.value.find((option) => option.code === currentLocale.value) ||
    availableLocales.value[0],
);

function closeMenu() {
  isOpen.value = false;
}

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function selectLocale(code: LocaleCode) {
  setLocale(code);
  closeMenu();
}

function handleDocumentClick(event: MouseEvent) {
  if (!switcherRef.value?.contains(event.target as Node)) {
    closeMenu();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div ref="switcherRef" class="locale-switcher">
    <button
      class="locale-trigger"
      type="button"
      :aria-label="t('nav.language')"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <span class="locale-code">{{ currentOption.shortLabel }}</span>
      <span class="locale-name">{{ currentOption.nativeLabel }}</span>
      <span class="locale-caret" aria-hidden="true" />
    </button>

    <Transition name="locale-menu">
      <div v-if="isOpen" class="locale-menu" role="listbox">
        <button
          v-for="option in availableLocales"
          :key="option.code"
          class="locale-option"
          :class="{ active: option.code === currentLocale }"
          type="button"
          role="option"
          :aria-selected="option.code === currentLocale"
          @click="selectLocale(option.code)"
        >
          <span class="locale-option-code">{{ option.shortLabel }}</span>
          <span class="locale-option-copy">
            <strong>{{ option.nativeLabel }}</strong>
            <small>{{ option.label }}</small>
          </span>
          <span
            v-if="option.code === currentLocale"
            class="locale-check"
            aria-hidden="true"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.locale-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.locale-trigger {
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
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.locale-trigger:hover,
.locale-trigger[aria-expanded="true"] {
  border-color: rgba(31, 122, 77, 0.38);
  background: var(--surface-soft);
}

.locale-code,
.locale-option-code {
  display: inline-grid;
  width: 28px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 10px;
  font-weight: 900;
}

.locale-name {
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-caret {
  width: 7px;
  height: 7px;
  border-right: 1.8px solid currentColor;
  border-bottom: 1.8px solid currentColor;
  opacity: 0.72;
  transform: translateY(-2px) rotate(45deg);
}

.locale-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1000;
  display: grid;
  width: 220px;
  gap: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 18px 50px rgba(20, 34, 27, 0.16);
  padding: 6px;
}

.locale-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 12px;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  padding: 7px 9px;
  text-align: left;
}

.locale-option:hover,
.locale-option.active {
  background: var(--surface-soft);
}

.locale-option-copy {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.locale-option-copy strong,
.locale-option-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-option-copy strong {
  font-size: 13px;
  font-weight: 800;
}

.locale-option-copy small {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.locale-check {
  width: 9px;
  height: 14px;
  border-right: 2px solid var(--green);
  border-bottom: 2px solid var(--green);
  transform: rotate(45deg);
}

.locale-menu-enter-active,
.locale-menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.locale-menu-enter-from,
.locale-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.locale-trigger:focus-visible,
.locale-option:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

:global(html[data-theme="dark"]) .locale-menu {
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.38);
}

@media (max-width: 700px) {
  .locale-menu {
    right: auto;
    left: 50%;
    transform: translateX(-50%);
  }

  .locale-menu-enter-from,
  .locale-menu-leave-to {
    transform: translateX(-50%) translateY(-4px);
  }
}
</style>
