<script setup lang="ts">
const route = useRoute();

await navigateTo(
  { path: "/store", query: { ...route.query, tab: "profile" } },
  { redirectCode: 301, replace: true },
);
</script>

<template>
  <div />
</template>
