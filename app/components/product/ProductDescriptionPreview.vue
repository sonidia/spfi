<script setup lang="ts">
import { computed } from "vue";
import { renderProductDescription } from "~~/utils/product-description";

const props = defineProps<{ content: string }>();
const renderedDescription = computed(() => renderProductDescription(props.content));
</script>

<template>
  <!-- Content is escaped or allow-list sanitized by renderProductDescription. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="product-description-preview" v-html="renderedDescription" />
</template>

<style scoped>
.product-description-preview {
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.product-description-preview :deep(> :first-child) {
  margin-top: 0;
}

.product-description-preview :deep(> :last-child) {
  margin-bottom: 0;
}

.product-description-preview :deep(h1),
.product-description-preview :deep(h2),
.product-description-preview :deep(h3),
.product-description-preview :deep(h4),
.product-description-preview :deep(h5),
.product-description-preview :deep(h6) {
  margin: 14px 0 6px;
  color: var(--text);
  line-height: 1.3;
}

.product-description-preview :deep(h1) {
  font-size: 19px;
}

.product-description-preview :deep(h2) {
  font-size: 17px;
}

.product-description-preview :deep(h3) {
  font-size: 15px;
}

.product-description-preview :deep(p),
.product-description-preview :deep(ul),
.product-description-preview :deep(ol),
.product-description-preview :deep(blockquote),
.product-description-preview :deep(pre) {
  margin: 8px 0;
}

.product-description-preview :deep(ul),
.product-description-preview :deep(ol) {
  padding-inline-start: 22px;
}

.product-description-preview :deep(blockquote) {
  border-inline-start: 3px solid var(--green);
  padding: 7px 11px;
  border-radius: 0 6px 6px 0;
  background: var(--surface-soft);
}

.product-description-preview :deep(code) {
  border-radius: 4px;
  padding: 1px 4px;
  background: var(--surface-soft);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.92em;
}

.product-description-preview :deep(pre) {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px;
  background: var(--surface-soft);
}

.product-description-preview :deep(pre code) {
  padding: 0;
  background: transparent;
}

.product-description-preview :deep(a) {
  color: var(--text-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
