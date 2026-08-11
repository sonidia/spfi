<script setup lang="ts">
import type { CheckItem, CheckSeverity } from "~~/types/store-status";

defineProps<{
  check: CheckItem;
  expanded: boolean;
  severityLabel: Record<CheckSeverity, string>;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <article
    class="check-card"
    :class="[`is-${check.severity}`, { 'is-collapsed': !expanded }]"
  >
    <button
      class="check-heading"
      type="button"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <div>
        <h3>{{ check.title }}</h3>
        <p>{{ check.status }}</p>
      </div>
      <span>{{ severityLabel[check.severity] }}</span>
      <i class="check-card-toggle" aria-hidden="true" />
    </button>

    <ul v-show="expanded">
      <li v-for="detail in check.details" :key="detail">
        {{ detail }}
      </li>
    </ul>
  </article>
</template>

<style scoped>
.check-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 16px;
}

.check-heading {
  display: flex;
  width: 100%;
  gap: 16px;
  align-items: start;
  justify-content: space-between;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.check-heading > div {
  min-width: 0;
  flex: 1 1 auto;
}

.check-heading h3 {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0;
}

.check-heading p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.check-heading span {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 0.78rem;
  font-weight: 600;
}

.check-card-toggle {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.16s ease;
  margin-top: 4px;
}

.check-card.is-collapsed .check-card-toggle {
  transform: rotate(-45deg);
}

.check-card ul {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--muted);
  line-height: 1.55;
}

.is-ok {
  border-color: rgba(31, 122, 77, 0.28);
}

.is-ok .check-heading span {
  background: var(--green-soft);
  color: var(--green);
}

.is-warning {
  border-color: rgba(155, 100, 22, 0.3);
}

.is-warning .check-heading span {
  background: var(--amber-soft);
  color: var(--amber);
}

.is-danger {
  border-color: rgba(180, 49, 43, 0.28);
}

.is-danger .check-heading span {
  background: var(--red-soft);
  color: var(--red);
}

@media (max-width: 560px) {
  .check-heading {
    display: grid;
  }

  .check-heading span {
    width: fit-content;
  }
}
</style>
