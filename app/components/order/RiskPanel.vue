<script setup lang="ts">
import { Plus, Save, ShieldAlert } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import type {
  RiskAssessmentLevel,
  RiskFactSentiment,
} from "~~/types/shopify-order";

const props = defineProps<{ orderId: string | number }>();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const isComposerOpen = ref(false);
const riskLevel = ref<RiskAssessmentLevel>("PENDING");
const factDescription = ref("");
const factSentiment = ref<RiskFactSentiment>("NEUTRAL");
const risk = computed(() => orderStore.riskByOrder[String(props.orderId)]);
const riskLevelOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "None", value: "NONE" },
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
];
const sentimentOptions = [
  { label: "Negative", value: "NEGATIVE" },
  { label: "Neutral", value: "NEUTRAL" },
  { label: "Positive", value: "POSITIVE" },
];
const riskScore = computed(() => {
  const scores: Record<RiskAssessmentLevel, number> = {
    PENDING: 0,
    NONE: 1,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  };
  return Math.max(
    0,
    ...(risk.value?.assessments.map(
      (assessment) => scores[assessment.riskLevel],
    ) || []),
  );
});
const displayRiskLevel = computed<RiskAssessmentLevel>(() => {
  if (riskScore.value === 3) return "HIGH";
  if (riskScore.value === 2) return "MEDIUM";
  if (riskScore.value === 1) return "LOW";

  const recommendation = risk.value?.recommendation?.toUpperCase();
  if (recommendation === "CANCEL") return "HIGH";
  if (recommendation === "INVESTIGATE") return "MEDIUM";
  if (recommendation === "ACCEPT") return "LOW";
  return "PENDING";
});
const meterScore = computed(() => {
  if (displayRiskLevel.value === "HIGH") return 3;
  if (displayRiskLevel.value === "MEDIUM") return 2;
  if (["LOW", "NONE"].includes(displayRiskLevel.value)) return 1;
  return 0;
});
const riskMessage = computed(() => {
  if (displayRiskLevel.value === "HIGH") {
    return "Chargeback risk is high. Review this order before fulfillment.";
  }
  if (displayRiskLevel.value === "MEDIUM") {
    return "Chargeback risk is medium. Review the available signals before fulfillment.";
  }
  if (["LOW", "NONE"].includes(displayRiskLevel.value)) {
    return "Chargeback risk is low. You can fulfill this order.";
  }
  return "Risk assessment is pending. Review the order before fulfillment.";
});

async function loadRisk() {
  if (!isReady.value) return;
  await orderStore.fetchRiskAssessments(storeId.value, token.value, props.orderId);
}

async function createAssessment() {
  if (!isReady.value) return;
  const created = await orderStore.createRiskAssessment(
    storeId.value,
    token.value,
    props.orderId,
    riskLevel.value,
    factDescription.value.trim()
      ? [{ description: factDescription.value.trim(), sentiment: factSentiment.value }]
      : [],
  );
  if (created) {
    factDescription.value = "";
    isComposerOpen.value = false;
  }
}

function setRiskLevel(value: unknown) {
  if (["PENDING", "NONE", "LOW", "MEDIUM", "HIGH"].includes(String(value))) {
    riskLevel.value = value as RiskAssessmentLevel;
  }
}

function setFactSentiment(value: unknown) {
  if (["NEGATIVE", "NEUTRAL", "POSITIVE"].includes(String(value))) {
    factSentiment.value = value as RiskFactSentiment;
  }
}

onMounted(loadRisk);
watch([() => props.orderId, isReady], ([, ready]) => {
  if (ready) loadRisk();
});
</script>

<template>
  <section class="risk-panel" aria-labelledby="risk-panel-title">
    <header>
      <div class="panel-title"><ShieldAlert aria-hidden="true" /><h2 id="risk-panel-title">Order risk</h2></div>
      <BaseButton
        variant="ghost"
        icon-only
        :aria-label="
          isComposerOpen ? 'Close assessment form' : 'Add risk assessment'
        "
        :title="isComposerOpen ? 'Close assessment form' : 'Add risk assessment'"
        @click="isComposerOpen = !isComposerOpen"
      >
        <template #icon>
          <Plus :class="{ 'is-rotated': isComposerOpen }" />
        </template>
      </BaseButton>
    </header>

    <div class="risk-overview">
      <div
        class="risk-meter"
        :class="`is-${displayRiskLevel.toLowerCase()}`"
        role="meter"
        aria-label="Chargeback risk"
        aria-valuemin="0"
        aria-valuemax="3"
        :aria-valuenow="meterScore"
        :aria-valuetext="displayRiskLevel"
      >
        <div class="risk-track">
          <span :style="{ width: `${(meterScore / 3) * 100}%` }" />
        </div>
        <div class="risk-scale" aria-hidden="true">
          <span>Low</span><span>Medium</span><span>High</span>
        </div>
      </div>
      <p>{{ riskMessage }}</p>
      <div class="recommendation">
        <ShieldAlert :size="14" aria-hidden="true" />
        <span>Recommendation</span>
        <strong>{{ risk?.recommendation || "Pending" }}</strong>
      </div>
    </div>

    <template v-if="!isComposerOpen">
      <div v-if="risk?.assessments.length" class="assessment-list">
        <article
          v-for="(assessment, index) in risk.assessments"
          :key="`${assessment.provider?.title}-${index}`"
        >
          <div>
            <span
              class="risk-level"
              :class="`is-${assessment.riskLevel.toLowerCase()}`"
            >
              {{ assessment.riskLevel }}
            </span>
            <strong>{{ assessment.provider?.title || "Shopify" }}</strong>
          </div>
          <ul v-if="assessment.facts.length">
            <li
              v-for="fact in assessment.facts"
              :key="`${fact.description}-${fact.sentiment}`"
            >
              {{ fact.description }}
              <span>{{ fact.sentiment }}</span>
            </li>
          </ul>
        </article>
      </div>
      <div v-else class="risk-empty">No assessment details yet.</div>
    </template>

    <div v-if="orderStore.riskError" class="risk-error" role="alert">
      {{ orderStore.riskError }}
    </div>

    <div v-if="isComposerOpen" class="composer">
      <label>
        <span>Risk level</span>
        <BaseSelect
          :model-value="riskLevel"
          :options="riskLevelOptions"
          @update:model-value="setRiskLevel"
        />
      </label>
      <label class="fact-field">
        <span>Fact</span>
        <input v-model="factDescription" />
      </label>
      <label>
        <span>Sentiment</span>
        <BaseSelect
          :model-value="factSentiment"
          :options="sentimentOptions"
          @update:model-value="setFactSentiment"
        />
      </label>
      <BaseButton
        variant="primary"
        :loading="orderStore.isRiskLoading"
        @click="createAssessment"
      >
        <template #icon><Save /></template>
        Create assessment
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.risk-panel { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); overflow: visible; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--border); }
header span, label > span { color: var(--text-sub); font-size: 11px; font-weight: 600; }
.panel-title { min-width: 0; display: inline-flex; align-items: center; gap: 8px; }
.panel-title :deep(svg) { width: 16px; height: 16px; flex: 0 0 16px; color: var(--green); }
h2 { color: var(--text); font-size: 15px; }
.is-rotated { transform: rotate(45deg); }
.risk-overview { display: grid; gap: 12px; padding: 15px 16px; }
.risk-meter { display: grid; gap: 8px; }
.risk-track { height: 9px; overflow: hidden; border-radius: 999px; background: var(--surface-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 76%, transparent); }
.risk-track span { display: block; height: 100%; border-radius: inherit; background: var(--green); transition: width 0.3s ease, background 0.2s ease; }
.risk-meter.is-medium .risk-track span { background: var(--amber); }
.risk-meter.is-high .risk-track span { background: var(--red); }
.risk-meter.is-pending .risk-track span { background: var(--text-muted); }
.risk-scale { display: grid; grid-template-columns: repeat(3, 1fr); color: var(--text-sub); font-size: 11px; font-weight: 600; text-align: center; }
.risk-overview p { color: var(--text); font-size: 12px; line-height: 1.45; }
.recommendation { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border); color: var(--text-sub); font-size: 11px; }
.recommendation strong { color: var(--text); font-size: 11px; text-transform: capitalize; }
.assessment-list { display: grid; border-top: 1px solid var(--border); }
article { display: grid; gap: 9px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
article > div { display: flex; align-items: center; gap: 8px; }
article strong { color: var(--text); font-size: 12px; }
.risk-level { padding: 3px 7px; border-radius: 999px; background: var(--surface-soft); }
.risk-level.is-low, .risk-level.is-none { background: var(--green-soft); color: var(--green); }
.risk-level.is-medium, .risk-level.is-pending { background: var(--amber-soft); color: var(--amber); }
.risk-level.is-high { background: var(--red-soft); color: var(--red); }
ul { display: grid; gap: 5px; padding-left: 16px; color: var(--text-sub); font-size: 12px; }
li span { margin-left: 5px; color: var(--text-muted); font-size: 10px; }
.risk-empty { padding: 0 16px 14px; color: var(--text-muted); font-size: 11px; }
.risk-error { padding: 10px 16px; border-top: 1px solid rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); font-size: 12px; }
.composer { display: grid; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--border); background: var(--surface-soft); }
label { display: grid; gap: 5px; }
input { width: 100%; height: 38px; border: 1px solid var(--border); border-radius: 6px; padding: 0 9px; background: var(--surface-raised); color: var(--text); font: inherit; }
input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent); }

@media (max-width: 760px) {
  .risk-panel { max-width: none; }
}
</style>
