<script setup lang="ts">
import type { NuxtError } from "#app";

defineProps<{ error: NuxtError }>();

function reload() {
  if (import.meta.client) window.location.reload();
}

function goHome() {
  void clearError({ redirect: "/" });
}
</script>

<template>
  <main class="global-error-page">
    <AppErrorState :error="error" @retry="reload" @home="goHome" />
  </main>
</template>

<style scoped>
.global-error-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 16px;
  background: var(--bg);
}
</style>
