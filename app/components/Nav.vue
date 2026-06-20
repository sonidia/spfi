<script setup lang="ts">
const isScrolled = ref(false);
let pageScrollContainer: Element | null = null;

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
        <NuxtLink to="/setup">Setup</NuxtLink>
        <NuxtLink to="/manager">Manager</NuxtLink>
        <NuxtLink to="/profile">Profile</NuxtLink>
        <NuxtLink to="/payment">Payment</NuxtLink>
        <NuxtLink to="/sheet">Sheet</NuxtLink>
        <NuxtLink to="/status">Status</NuxtLink>
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
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
  box-shadow: 0 8px 24px rgba(20, 34, 27, 0.06);
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
  text-shadow: 0 0 2px rgba(31, 122, 77, 0.14);
}
.nav-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.nav-list a {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  transition:
    background 0.15s,
    color 0.15s;
  text-decoration: none;
}
.nav-list a:hover {
  background: var(--surface-soft);
  color: var(--green);
}
.nav-list a.router-link-active {
  background: var(--green-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(31, 122, 77, 0.14);
}

@media (max-width: 700px) {
  .topbar {
    padding: 12px 16px;
  }

  .topbar-inner {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
