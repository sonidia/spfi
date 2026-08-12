<script setup lang="ts">
import { Search } from "@lucide/vue";

const router = useRouter();
const route = useRoute();
const { t } = useLocalization();
const isOpen = ref(false);
const query = ref("");
const activeIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const dialog = ref<HTMLElement | null>(null);
let focusReturnTarget: HTMLElement | null = null;

const commands = computed(() => [
  { id: "dashboard", label: t("nav.dashboard"), path: "/dashboard", shortcut: "Alt+D" },
  { id: "store", label: t("nav.store"), path: "/store", shortcut: "Alt+S" },
  { id: "orders", label: t("order.title"), path: "/order", shortcut: "Alt+O" },
  { id: "manager", label: t("nav.manager"), path: "/manager", shortcut: "Alt+M" },
  { id: "status", label: t("nav.status"), path: "/status", shortcut: "" },
  { id: "sheet", label: t("nav.sheet"), path: "/sheet", shortcut: "" },
  { id: "settings", label: t("nav.settings"), path: "/settings", shortcut: "" },
  { id: "setup", label: t("nav.setup"), path: "/setup", shortcut: "" },
]);

const filteredCommands = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return commands.value;
  return commands.value.filter((command) =>
    `${command.label} ${command.id}`.toLocaleLowerCase().includes(needle),
  );
});
const activeCommandId = computed(() => {
  const command = filteredCommands.value[activeIndex.value];
  return command ? `command-option-${command.id}` : undefined;
});

watch(filteredCommands, () => {
  activeIndex.value = 0;
});

function openPalette() {
  focusReturnTarget =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  isOpen.value = true;
  query.value = "";
  activeIndex.value = 0;
  void nextTick(() => searchInput.value?.focus());
}

function closePalette() {
  isOpen.value = false;
  const target = focusReturnTarget;
  focusReturnTarget = null;
  void nextTick(() => target?.focus());
}

function withActiveStore(path: string) {
  const shop = Array.isArray(route.query.shop) ? route.query.shop[0] : route.query.shop;
  return shop && ["/store", "/order"].includes(path) ? { path, query: { shop } } : path;
}

async function runCommand(index = activeIndex.value) {
  const command = filteredCommands.value[index];
  if (!command) return;
  isOpen.value = false;
  focusReturnTarget = null;
  await router.push(withActiveStore(command.path));
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (isOpen.value) closePalette();
    else openPalette();
    return;
  }
  if (event.key === "?" && !isEditableTarget(event.target)) {
    event.preventDefault();
    openPalette();
    return;
  }
  if (
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isEditableTarget(event.target)
  ) {
    return;
  }

  const commandId = (
    { d: "dashboard", s: "store", o: "orders", m: "manager" } as const
  )[event.key.toLowerCase() as "d" | "s" | "o" | "m"];
  const commandIndex = commands.value.findIndex((command) => command.id === commandId);
  if (commandIndex >= 0) {
    event.preventDefault();
    const command = commands.value[commandIndex];
    if (command) void router.push(withActiveStore(command.path));
  }
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closePalette();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value =
      (activeIndex.value + 1) % Math.max(filteredCommands.value.length, 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + Math.max(filteredCommands.value.length, 1)) %
      Math.max(filteredCommands.value.length, 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    void runCommand();
  } else if (event.key === "Tab") {
    const focusable = dialog.value?.querySelectorAll<HTMLElement>(
      'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("spf:open-command-palette", openPalette);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("spf:open-command-palette", openPalette);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="command-backdrop" @mousedown.self="closePalette">
      <section
        ref="dialog"
        class="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        @keydown="handleDialogKeydown"
      >
        <header>
          <h2 id="command-title">{{ t("command.title") }}</h2>
          <kbd>Esc</kbd>
        </header>
        <label class="command-search">
          <Search :size="17" aria-hidden="true" />
          <span class="sr-only">{{ t("common.search") }}</span>
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-options"
            :aria-expanded="isOpen"
            :aria-activedescendant="activeCommandId"
            :placeholder="t('command.searchPlaceholder')"
            autocomplete="off"
          />
        </label>
        <div id="command-options" class="command-list" role="listbox">
          <button
            v-for="(command, index) in filteredCommands"
            :key="command.id"
            :id="`command-option-${command.id}`"
            type="button"
            role="option"
            :aria-selected="index === activeIndex"
            :class="{ active: index === activeIndex }"
            @mouseenter="activeIndex = index"
            @click="runCommand(index)"
          >
            <span>{{ command.label }}</span>
            <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
          </button>
          <p v-if="!filteredCommands.length" class="command-empty">
            {{ t("command.noResults") }}
          </p>
        </div>
        <footer>{{ t("command.keyboardHint") }}</footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.command-backdrop {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: grid;
  align-items: start;
  justify-items: center;
  padding: min(14vh, 110px) 16px 16px;
  background: rgba(10, 16, 12, 0.45);
  backdrop-filter: blur(5px);
}

.command-dialog {
  width: min(100%, 620px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.3);
}

.command-dialog header,
.command-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.command-dialog h2 {
  font-size: 14px;
}

.command-dialog footer {
  border-top: 1px solid var(--border);
  color: var(--text-sub);
  font-size: 11px;
}

kbd {
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface-soft);
  color: var(--text-sub);
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.command-search {
  display: flex;
  align-items: center;
  gap: 9px;
  border-block: 1px solid var(--border);
  padding: 0 14px;
  color: var(--text-sub);
}

.command-search input {
  width: 100%;
  min-height: 48px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  outline: 0;
}

.command-list {
  max-height: min(55vh, 420px);
  overflow-y: auto;
  padding: 7px;
}

.command-list button {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  padding: 8px 10px;
  font: inherit;
  text-align: start;
}

.command-list button.active {
  background: var(--green-soft);
  color: var(--green);
}

.command-empty {
  padding: 28px 12px;
  color: var(--text-sub);
  text-align: center;
}

@media (prefers-reduced-motion: no-preference) {
  .command-dialog {
    animation: command-enter 0.16s ease-out;
  }
}

@keyframes command-enter {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
}
</style>
