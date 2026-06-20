<script setup lang="ts">
defineProps<{
  title: string;
  sub: string;
}>();
</script>

<template>
  <div class="page-header">
    <div v-if="$slots.default" class="hero-icon">
      <slot />
    </div>
    <div class="page-header-text">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">
        {{ sub }}
      </p>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  min-width: 0;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--green-soft, #dff4e8);
  color: var(--green, #1f7a4d);
  flex-shrink: 0;
}

.hero-icon :deep(svg) {
  width: 28px;
  height: 28px;
}

.page-header-text {
  min-width: 0;
  flex: 1 1 auto;
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

.page-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 640px) {
  .page-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .page-header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
