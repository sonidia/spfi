<!-- components/AppLoading.vue -->
<template>
  <div v-if="loading" class="loading-overlay">
    <div class="spinner" />
  </div>
</template>

<script setup>
const { loading } = useLoading();
</script>

<style>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
</style>
