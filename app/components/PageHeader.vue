<script setup lang="ts">
defineProps<{
  title: string;
  sub: string;
}>();
</script>

<template>
  <div class="page-header">
    <div class="hero-icon">
      <slot />
    </div>
    <div class="page-header-text">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">
        {{ sub }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: #5b47e0;
  flex-shrink: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-sub {
  font-size: 13px;
  color: var(--text-secondary, #6d6d6d);
}
</style>
