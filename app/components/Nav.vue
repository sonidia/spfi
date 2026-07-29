<script setup lang="ts">
const route = useRoute();
const isScrolled = ref(false);
const { t } = useLocalization();
let pageScrollContainer: Element | null = null;

function withActiveShop(path: string) {
  const shop = Array.isArray(route.query.shop)
    ? route.query.shop[0]
    : route.query.shop;

  return shop ? { path, query: { shop } } : path;
}

function updateScrollState() {
  isScrolled.value =
    window.scrollY > 0 || Number(pageScrollContainer?.scrollTop || 0) > 0;
}

onMounted(() => {
  pageScrollContainer = document.querySelector(".page-content");
  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });
  pageScrollContainer?.addEventListener("scroll", updateScrollState, {
    passive: true,
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateScrollState);
  pageScrollContainer?.removeEventListener("scroll", updateScrollState);
});
</script>

<template>
  <nav class="topbar" :class="{ 'is-scrolled': isScrolled }">
    <div class="topbar-inner">
      <NuxtLink class="brand" to="/">
        <img src="/favicon.svg" alt="Logo" />
        <span class="topbar-title">Spfi</span>
      </NuxtLink>
      <div class="nav-list">
        <NuxtLink to="/setup">{{ t("nav.setup") }}</NuxtLink>
        <NuxtLink to="/manager">{{ t("nav.manager") }}</NuxtLink>
        <NuxtLink :to="withActiveShop('/profile')">{{ t("nav.profile") }}</NuxtLink>
        <NuxtLink :to="withActiveShop('/customer')">{{ t("nav.customers") }}</NuxtLink>
        <NuxtLink :to="withActiveShop('/payment')">{{ t("nav.payment") }}</NuxtLink>
        <NuxtLink to="/sheet">{{ t("nav.sheet") }}</NuxtLink>
        <NuxtLink to="/status">{{ t("nav.status") }}</NuxtLink>
      </div>
      <div class="topbar-controls">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </div>
  </nav>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: transparent;
  border-bottom: 1px solid transparent;
  min-height: 58px;
  padding: 0 24px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.topbar.is-scrolled {
  background: var(--surface-overlay);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
  box-shadow: var(--shadow-soft);
}
.topbar-inner {
  width: min(100%, 1400px);
  min-height: 58px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.brand {
  display: flex;
  align-items: center;
}
.topbar-title {
  color: var(--text);
  font-weight: 800;
  font-size: 1.2rem;
  margin-left: 8px;
  text-shadow: 1px 1px 2px rgba(31, 122, 77, 0.2);
}
.nav-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.topbar-controls {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}
.nav-list a {
  position: relative;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
  text-decoration: none;
}

.nav-list a::after {
  content: "";
  position: absolute;
  left: 11px;
  right: 11px;
  bottom: 3px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0.35);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.nav-list a:hover {
  color: var(--green);
  transform: translateY(-1px);
}

.nav-list a:hover::after {
  opacity: 1;
  transform: scaleX(1);
}

.nav-list a.router-link-active {
  background: var(--green-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(31, 122, 77, 0.14);
}

.nav-list a.router-link-active:hover::after {
  opacity: 0;
}

.nav-list a:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

@media (max-width: 700px) {
  .topbar {
    padding: 12px 16px;
  }

  .topbar-inner {
    flex-direction: column;
    gap: 10px;
  }

  .topbar-controls {
    justify-content: center;
  }
}
</style>
