<script setup lang="ts">
const route = useRoute();

await navigateTo(
  {
    path: `/store/payout/${String(route.params.id || "")}`,
    query: { ...route.query },
  },
  { redirectCode: 301, replace: true },
);
</script>

<template>
  <div />
</template>
