<script setup lang="ts">
import { Clock, RefreshCw } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import type { ShopifyOrder, ShopifyOrderEvent } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const { storeId, token, isReady } = useActiveShopAuth();
const events = ref<ShopifyOrderEvent[]>([]);
const isLoading = ref(false);
const error = ref("");

const groupedEvents = computed(() => {
  const groups = new Map<
    string,
    Array<ShopifyOrderEvent & { time: string; text: string; dotType: string }>
  >();

  for (const event of [...events.value].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )) {
    const date = formatDate(event.created_at);
    const group = groups.get(date) || [];
    group.push({
      ...event,
      time: formatTime(event.created_at),
      text:
        event.description || stripHtml(event.message || "") || humanizeVerb(event.verb),
      dotType: eventDotType(event.verb),
    });
    groups.set(date, group);
  }

  return Array.from(groups, ([date, items]) => ({ date, items }));
});

onMounted(loadEvents);
watch(
  () => [props.order.id, props.order.updated_at],
  () => loadEvents(),
);
watch(isReady, (ready) => {
  if (ready) void loadEvents();
});

async function loadEvents() {
  if (!isReady.value || isLoading.value) return;
  isLoading.value = true;
  error.value = "";
  try {
    const response = await orderApi.getEvents(
      { storeId: storeId.value, token: token.value },
      props.order.id,
    );
    events.value = response.events || [];
  } catch (fetchError) {
    error.value = getAppErrorMessage(fetchError, "Failed to load the order timeline.");
  } finally {
    isLoading.value = false;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value)
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeVerb(value: string) {
  return String(value || "Order event")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function eventDotType(verb: string) {
  const normalized = String(verb || "").toLowerCase();
  if (normalized.includes("failure") || normalized.includes("cancel")) {
    return "error";
  }
  if (
    normalized.includes("success") ||
    normalized === "fulfilled" ||
    normalized === "paid"
  ) {
    return "success";
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("email") ||
    normalized.includes("authorization") ||
    normalized.includes("capture") ||
    normalized.includes("refund") ||
    normalized.includes("sale")
  ) {
    return "info";
  }
  return "";
}
</script>

<template>
  <div class="timeline-wrap">
    <div class="timeline-section-head">
      <div class="timeline-title">
        <Clock aria-hidden="true" />
        <span>Timeline</span>
      </div>
      <BaseButton
        icon-only
        aria-label="Refresh timeline"
        :loading="isLoading"
        @click="loadEvents"
      >
        <template #icon><RefreshCw /></template>
      </BaseButton>
    </div>

    <div class="timeline-body">
      <div v-if="isLoading && !events.length" class="timeline-state">
        Loading timeline...
      </div>
      <div v-else-if="error" class="timeline-state is-error" role="alert">
        {{ error }}
      </div>
      <div v-else-if="!groupedEvents.length" class="timeline-state">
        No Shopify events are available for this order.
      </div>

      <div v-for="group in groupedEvents" :key="group.date">
        <div class="date-label">{{ group.date }}</div>
        <div v-for="event in group.items" :key="event.id" class="event-row">
          <div class="dot-col"><div :class="['dot', event.dotType]" /></div>
          <div class="event-content">
            <div class="event-row-inner">
              <div class="event-text">{{ event.text }}</div>
              <div class="event-time">{{ event.time }}</div>
            </div>
            <div v-if="event.author" class="event-author">by {{ event.author }}</div>
            <div v-if="event.body" class="detail-box">{{ event.body }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.timeline-wrap {
  color: var(--text);
  font-size: 14px;
}
.timeline-section-head {
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--border);
}
.timeline-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
}
.timeline-title :deep(svg) {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--green);
}
.timeline-body {
  padding: 0 16px 16px;
}
.timeline-state {
  padding: 18px 0;
  color: var(--text-sub);
  font-size: 12px;
}
.timeline-state.is-error {
  color: var(--red);
}
.date-label {
  margin: 20px 0 7px 28px;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
}
.dot-col {
  display: flex;
  flex: 0 0 18px;
  align-items: flex-start;
  padding-top: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}
.dot.success {
  background: var(--green);
}
.dot.info {
  background: var(--blue);
}
.dot.error {
  background: var(--red);
}
.event-content {
  flex: 1;
  min-width: 0;
}
.event-row-inner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.event-text {
  flex: 1;
  color: var(--text);
  line-height: 1.5;
}
.event-time {
  padding-top: 2px;
  color: var(--text-sub);
  font-size: 12px;
  white-space: nowrap;
}
.event-author {
  margin-top: 2px;
  color: var(--text-sub);
  font-size: 11px;
}
.detail-box {
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
