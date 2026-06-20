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
        <div class="topbar-logo">
          <svg viewBox="0 0 24 24">
            <path
              d="M15.337 2.24l-.19-.02c-.26-.02-.47.17-.49.43l-.26 2.6-1.16-.22c-.22-.04-.44.08-.52.29l-3.3 9.9-1.4-3.33c-.1-.23-.34-.38-.58-.35l-1.3.18L5.5 7.5c-.04-.27-.29-.46-.56-.42l-1.5.22L2.08 18.5l7.42 1.3L21.5 18 15.337 2.24z"
            />
          </svg>
        </div>
        <span class="topbar-title">Shopify</span>
      </NuxtLink>
      <div class="nav-list">
        <NuxtLink to="/setup">Setup</NuxtLink>
        <NuxtLink to="/manager">Manager</NuxtLink>
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
.topbar-logo {
  width: 28px;
  height: 28px;
  background: linear-gradient(145deg, var(--green), var(--blue));
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px rgba(31, 122, 77, 0.18);
}
.topbar-logo svg {
  width: 18px;
  height: 18px;
  fill: white;
}
.topbar-title {
  color: var(--text);
  font-weight: 800;
  font-size: 14px;
  margin-left: 8px;
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
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .nav-list {
    justify-content: flex-start;
  }
}
</style>
