<template>
  <nav class="topbar">
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
      <NuxtLink to="/order">Order</NuxtLink>
      <NuxtLink to="/payment">Payment</NuxtLink>
      <NuxtLink to="/manager">Manager</NuxtLink>
      <NuxtLink to="/sheet">Sheet</NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.topbar {
  background: #1a1a1a;
  height: 56px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 16px;
  gap: 8px;
}
.brand {
  display: flex;
  align-items: center;
}
.topbar-logo {
  width: 28px;
  height: 28px;
  background: #95bf47;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.topbar-logo svg {
  width: 18px;
  height: 18px;
  fill: white;
}
.topbar-title {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  margin-left: 4px;
}
.nav-list {
  display: flex;
  gap: 4px;
}
.nav-list a {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 6px;
  transition:
    background 0.15s,
    color 0.15s;
  text-decoration: none;
}
.nav-list a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.nav-list a.router-link-active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
</style>
