<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="app-footer">
    &copy; {{ currentYear }} thuongtruong. All rights reserved.
  </footer>
</template>

<style scoped>
.app-footer {
  min-height: var(--footer-height, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
}
</style>
