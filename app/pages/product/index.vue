<template>
  <div />
</template>

<script setup lang="ts">
const route = useRoute();

await navigateTo(
  {
    path: "/store",
    query: {
      ...route.query,
      tab: "products",
    },
  },
  { replace: true },
);
</script>
