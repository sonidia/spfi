<script setup lang="ts">
const currentYear = new Date().getFullYear();
const { t } = useLocalization();
</script>

<template>
  <footer class="app-footer">
    {{ t("footer.copyright", { year: currentYear }) }}
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
