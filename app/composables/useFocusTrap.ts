import type { MaybeRefOrGetter, Ref } from "vue";
import { nextTick, onMounted, onUnmounted, toValue, watch } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface FocusTrapOptions {
  active?: MaybeRefOrGetter<boolean>;
  initialFocus?: () => HTMLElement | null;
  onEscape?: () => void;
}

export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  options: FocusTrapOptions = {},
) {
  let previousFocus: HTMLElement | null = null;
  let isListening = false;

  const isActive = () => options.active === undefined || toValue(options.active);

  function getFocusableElements() {
    if (!container.value) return [];
    return Array.from(
      container.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
    );
  }

  function focusInitialElement() {
    const target =
      options.initialFocus?.() || getFocusableElements()[0] || container.value;
    target?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isActive()) return;

    if (event.key === "Escape" && options.onEscape) {
      event.preventDefault();
      options.onEscape();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      container.value?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    const activeElement = document.activeElement;
    if (
      event.shiftKey &&
      (activeElement === first || !container.value?.contains(activeElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function handleFocusIn(event: FocusEvent) {
    if (!isActive() || container.value?.contains(event.target as Node)) return;
    focusInitialElement();
  }

  async function activate() {
    if (typeof document === "undefined" || !isActive()) return;
    previousFocus = document.activeElement as HTMLElement | null;
    if (!isListening) {
      document.addEventListener("focusin", handleFocusIn);
      isListening = true;
    }
    await nextTick();
    focusInitialElement();
  }

  function deactivate() {
    if (typeof document === "undefined") return;
    if (isListening) {
      document.removeEventListener("focusin", handleFocusIn);
      isListening = false;
    }
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }

  if (options.active !== undefined) {
    watch(
      () => toValue(options.active),
      (active) => (active ? void activate() : deactivate()),
    );
  }

  onMounted(() => {
    if (isActive()) void activate();
  });
  onUnmounted(deactivate);

  return { handleKeydown };
}
