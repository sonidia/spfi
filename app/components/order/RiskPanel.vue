<script setup lang="ts">
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

onMounted(loadRisk);
watch(() => props.orderId, loadRisk);
</script>

<template>
  <section class="risk-panel" aria-labelledby="risk-panel-title">
    <header>
      <div>
        <span>GraphQL Risk Assessment API</span>
        <h2 id="risk-panel-title">Order risk</h2>
      </div>
      <div class="risk-summary">
        <span>Recommendation</span>
        <strong>{{ risk?.recommendation || "Pending" }}</strong>
      </div>
      <button type="button" @click="isComposerOpen = !isComposerOpen">
        <IconsAdd />
        Assessment
      </button>
    </header>

    <div v-if="risk?.assessments.length" class="assessment-list">
      <article v-for="(assessment, index) in risk.assessments" :key="`${assessment.provider?.title}-${index}`">
        <div>
          <span class="risk-level" :class="`is-${assessment.riskLevel.toLowerCase()}`">
            {{ assessment.riskLevel }}
          </span>
          <strong>{{ assessment.provider?.title || "Shopify" }}</strong>
        </div>
        <ul v-if="assessment.facts.length">
          <li v-for="fact in assessment.facts" :key="`${fact.description}-${fact.sentiment}`">
            {{ fact.description }}
            <span>{{ fact.sentiment }}</span>
          </li>
        </ul>
      </article>
    </div>
    <div v-else class="risk-empty">No risk assessments returned.</div>

    <div v-if="orderStore.riskError" class="risk-error" role="alert">
      {{ orderStore.riskError }}
    </div>

    <div v-if="isComposerOpen" class="composer">
      <label>
        <span>Risk level</span>
        <select v-model="riskLevel">
          <option value="PENDING">Pending</option>
          <option value="NONE">None</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>
      <label class="fact-field"><span>Fact</span><input v-model="factDescription" /></label>
      <label>
        <span>Sentiment</span>
        <select v-model="factSentiment">
          <option value="NEGATIVE">Negative</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="POSITIVE">Positive</option>
        </select>
      </label>
      <button class="is-primary" type="button" :disabled="orderStore.isRiskLoading" @click="createAssessment">
        {{ orderStore.isRiskLoading ? "Saving..." : "Create" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.risk-panel { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: hidden; }
header { display: flex; align-items: center; gap: 18px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
header > div:first-child { margin-right: auto; }
header span, label > span { color: var(--text-sub); font-size: 11px; font-weight: 700; }
h2 { color: var(--text); font-size: 15px; }
.risk-summary { display: grid; text-align: right; }
.risk-summary strong { color: var(--text); font-size: 12px; text-transform: capitalize; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 0 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
button.is-primary { align-self: end; border-color: var(--green); background: var(--green); color: white; }
.assessment-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
article { display: grid; gap: 9px; padding: 14px 16px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
article > div { display: flex; align-items: center; gap: 8px; }
article strong { color: var(--text); font-size: 12px; }
.risk-level { padding: 3px 7px; border-radius: 999px; background: var(--surface-soft); }
.risk-level.is-low, .risk-level.is-none { background: var(--green-soft); color: var(--green); }
.risk-level.is-medium, .risk-level.is-pending { background: var(--amber-soft); color: var(--amber); }
.risk-level.is-high { background: var(--red-soft); color: var(--red); }
ul { display: grid; gap: 5px; padding-left: 16px; color: var(--text-sub); font-size: 12px; }
li span { margin-left: 5px; color: var(--text-muted); font-size: 10px; }
.risk-empty { padding: 18px 16px; color: var(--text-sub); font-size: 12px; }
.risk-error { padding: 10px 16px; border-top: 1px solid rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); font-size: 12px; }
.composer { display: grid; grid-template-columns: 130px minmax(180px, 1fr) 130px auto; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--border); background: var(--surface-soft); }
label { display: grid; gap: 5px; }
input, select { width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 6px; padding: 0 9px; background: var(--surface); color: var(--text); font: inherit; }

@media (max-width: 760px) {
  header { align-items: flex-start; flex-wrap: wrap; }
  .risk-summary { text-align: left; }
  .composer { grid-template-columns: 1fr; }
}
</style>
