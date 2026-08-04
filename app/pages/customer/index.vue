<script setup lang="ts">
const route = useRoute();

await navigateTo(
  { path: "/store", query: { ...route.query, tab: "customers" } },
  { redirectCode: 301, replace: true },
);
</script>

<template>
  <div />
</template>
