<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    sub: string;
    size?: "narrow" | "standard" | "wide" | "fluid";
  }>(),
  {
    size: "standard",
  },
);
</script>

<template>
  <main class="admin-page-shell" :class="`is-${size}`">
    <PageHeader :title="title" :sub="sub">
      <slot name="icon" />
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <div class="admin-page-body">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.admin-page-shell {
  width: min(100% - 40px, 1120px);
  margin: 0 auto;
  padding: 28px 0 56px;
}

.admin-page-shell.is-narrow {
  width: min(100% - 32px, 760px);
}

.admin-page-shell.is-wide {
  width: min(100% - 40px, 1180px);
}

.admin-page-shell.is-fluid {
  width: min(100% - 40px, 1400px);
}

.admin-page-body {
  min-width: 0;
}

@media (max-width: 560px) {
  .admin-page-shell,
  .admin-page-shell.is-wide,
  .admin-page-shell.is-fluid {
    width: min(100% - 24px, 680px);
    padding-top: 24px;
  }
}
</style>
