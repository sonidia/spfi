<template>
  <div>
    <span v-for="(line, index) in lines" :key="index" class="address-line">
      {{ line }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ShopifyAddress } from "~~/types/shopify";
import { getAddressLines } from "~~/utils/address";

const props = defineProps<{
  address?: ShopifyAddress | null;
}>();

const lines = computed(() => getAddressLines(props.address));
</script>

<style scoped>
.address-line {
  display: block;
}
</style>
