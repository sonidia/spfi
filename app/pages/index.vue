<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="hero-copy">
        <p class="eyebrow is-ok">{{ t("home.eyebrow") }}</p>
        <h1>{{ t("home.heroTitle") }}</h1>
        <p class="hero-sub">
          {{ t("home.heroSub") }}
        </p>
        <div class="hero-actions">
          <NuxtLink class="hero-btn hero-btn-primary" to="/manager">
            <IconsBulking />
            {{ t("home.openManager") }}
          </NuxtLink>
          <NuxtLink class="hero-btn hero-btn-secondary" to="/status">
            <IconsCheck />
            {{ t("home.checkStatus") }}
          </NuxtLink>
        </div>
      </div>

      <div class="ops-preview" :aria-label="t('home.previewAria')">
        <div class="preview-toolbar">
          <span />
          <span />
          <span />
          <strong>{{ t("home.previewLive") }}</strong>
        </div>
        <div class="preview-grid">
          <div class="preview-panel preview-panel-large">
            <div class="preview-panel-head">
              <span class="panel-kicker">{{ t("home.previewBatch") }}</span>
              <span class="panel-pill is-ok">{{ t("home.previewAlive") }}</span>
            </div>
            <div class="status-lines">
              <span class="line is-long" />
              <span class="line is-mid" />
              <span class="line is-short" />
            </div>
            <div class="signal-row">
              <span>{{ t("home.previewHttp") }}</span>
              <strong>200 OK</strong>
            </div>
            <div class="signal-row">
              <span>{{ t("home.previewProducts") }}</span>
              <strong>JSON</strong>
            </div>
          </div>

          <div class="preview-panel">
            <div class="preview-icon"><IconsRefresh /></div>
            <span>{{ t("home.previewToken") }}</span>
            <strong>{{ t("home.previewReady") }}</strong>
          </div>

          <div class="preview-panel">
            <div class="preview-icon"><IconsCopy /></div>
            <span>{{ t("home.previewSheet") }}</span>
            <strong>{{ t("home.previewTabs") }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="quick-links" :aria-label="t('home.workflowsAria')">
      <NuxtLink
        v-for="item in quickLinks"
        :key="item.to"
        class="workflow-card"
        :to="item.to"
      >
        <component :is="item.icon" class="workflow-icon" />
        <div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
        </div>
        <IconsArrowRight class="workflow-arrow" />
      </NuxtLink>
    </section>

    <section class="motivation-section landing-section">
      <div class="section-heading">
        <p class="eyebrow">{{ t("home.motivationEyebrow") }}</p>
        <h2>{{ t("home.motivationTitle") }}</h2>
        <p>
          {{ t("home.motivationBody") }}
        </p>
      </div>

      <div class="motivation-grid">
        <article
          v-for="item in motivationItems"
          :key="item.title"
          class="motivation-card"
        >
          <div class="motivation-icon">
            <component :is="item.icon" />
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="assurance-section landing-section">
      <div class="section-heading">
        <p class="eyebrow is-blue">{{ t("home.assuranceEyebrow") }}</p>
        <h2>{{ t("home.assuranceTitle") }}</h2>
        <p>
          {{ t("home.assuranceBody") }}
        </p>
      </div>

      <div class="assurance-grid">
        <article
          v-for="item in assuranceItems"
          :key="item.title"
          class="assurance-item"
        >
          <div class="assurance-icon">
            <component :is="item.icon" />
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="metrics-strip" :aria-label="t('home.metricsEyebrow')">
      <p class="eyebrow is-amber">{{ t("home.metricsEyebrow") }}</p>
      <div class="metrics-grid">
        <article
          v-for="item in metricItems"
          :key="item.label"
          class="metric-card"
        >
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>
    </section>

    <section class="runbook-section landing-section">
      <div class="section-heading section-heading-narrow">
        <p class="eyebrow is-blue">{{ t("home.flowEyebrow") }}</p>
        <h2>{{ t("home.flowTitle") }}</h2>
      </div>

      <div class="runbook-list">
        <article
          v-for="step in runbookSteps"
          :key="step.title"
          class="runbook-item"
        >
          <div class="runbook-item-head">
            <span>{{ step.step }}</span>
            <h3>{{ step.title }}</h3>
          </div>
          <p>{{ step.description }}</p>
        </article>
      </div>
    </section>

    <section class="faq-section landing-section">
      <div class="section-heading">
        <p class="eyebrow is-amber">{{ t("home.faqEyebrow") }}</p>
        <h2>{{ t("home.faqTitle") }}</h2>
      </div>

      <div class="faq-list">
        <details v-for="item in faqItems" :key="item.question" class="faq-item">
          <summary>
            <span>{{ item.question }}</span>
            <IconsAdd />
          </summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
    </section>

    <section class="landing-cta" :aria-label="t('home.ctaAria')">
      <div>
        <p class="eyebrow">{{ t("home.ctaEyebrow") }}</p>
        <h2>{{ t("home.ctaTitle") }}</h2>
      </div>
      <NuxtLink class="hero-btn hero-btn-primary" to="/manager">
        <IconsArrowRight />
        {{ t("home.openManager") }}
      </NuxtLink>
    </section>

    <AppFooter />
  </main>
</template>

<script setup lang="ts">
import IconsLandingClean from "~/components/icons/landing/Clean.vue";
import IconsLandingFlash from "~/components/icons/landing/Flash.vue";
import IconsLandingUsefull from "~/components/icons/landing/Usefull.vue";

const { t } = useLocalization();

const quickLinks = computed(() => [
  {
    to: "/setup",
    title: t("home.quickSetupTitle"),
    description: t("home.quickSetupDescription"),
    icon: "IconsHero",
  },
  {
    to: "/manager",
    title: t("home.quickManagerTitle"),
    description: t("home.quickManagerDescription"),
    icon: "IconsBulking",
  },
  {
    to: "/settings#sheets",
    title: t("home.quickSheetTitle"),
    description: t("home.quickSheetDescription"),
    icon: "IconsCopy",
  },
  {
    to: "/status",
    title: t("home.quickStatusTitle"),
    description: t("home.quickStatusDescription"),
    icon: "IconsCheck",
  },
]);

const motivationItems = computed(() => [
  {
    title: t("home.motivationTabsTitle"),
    description: t("home.motivationTabsDescription"),
    icon: IconsLandingFlash,
  },
  {
    title: t("home.motivationChecksTitle"),
    description: t("home.motivationChecksDescription"),
    icon: IconsLandingClean,
  },
  {
    title: t("home.motivationCopyTitle"),
    description: t("home.motivationCopyDescription"),
    icon: IconsLandingUsefull,
  },
]);

const assuranceItems = computed(() => [
  {
    title: t("home.assuranceVaultTitle"),
    description: t("home.assuranceVaultDescription"),
    icon: "IconsCheck",
  },
  {
    title: t("home.assuranceRateTitle"),
    description: t("home.assuranceRateDescription"),
    icon: "IconsSync",
  },
  {
    title: t("home.assuranceFlowTitle"),
    description: t("home.assuranceFlowDescription"),
    icon: "IconsRefresh",
  },
]);

const metricItems = computed(() => [
  {
    value: t("home.metricStoresValue"),
    label: t("home.metricStoresLabel"),
  },
  {
    value: t("home.metricTokensValue"),
    label: t("home.metricTokensLabel"),
  },
  {
    value: t("home.metricOrdersValue"),
    label: t("home.metricOrdersLabel"),
  },
]);

const runbookSteps = computed(() => [
  {
    step: "01",
    title: t("home.flowConnectTitle"),
    description: t("home.flowConnectDescription"),
  },
  {
    step: "02",
    title: t("home.flowCheckTitle"),
    description: t("home.flowCheckDescription"),
  },
  {
    step: "03",
    title: t("home.flowDataTitle"),
    description: t("home.flowDataDescription"),
  },
]);

const faqItems = computed(() => [
  {
    question: t("home.faqFirstQuestion"),
    answer: t("home.faqFirstAnswer"),
  },
  {
    question: t("home.faqAdminQuestion"),
    answer: t("home.faqAdminAnswer"),
  },
  {
    question: t("home.faqSheetQuestion"),
    answer: t("home.faqSheetAnswer"),
  },
  {
    question: t("home.faqBatchQuestion"),
    answer: t("home.faqBatchAnswer"),
  },
]);
</script>

<style scoped>
.landing-page {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
}

.landing-hero {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.8fr);
  min-height: calc(100vh - 190px);
  align-items: center;
  gap: 42px;
  animation: rise-in 0.72s ease both;
}

.hero-copy {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.eyebrow {
  margin: 0;
  color: var(--green);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
  background: var(--green-soft);
  color: var(--green);
  border-radius: 999px;
  padding: 4px 9px;
  width: fit-content;
}

.hero-copy h1 {
  max-width: 760px;
  margin: 0;
  color: var(--text);
  font-size: clamp(2.35rem, 7vw, 4.75rem);
  line-height: 0.98;
  letter-spacing: 0;
}

.hero-sub {
  max-width: 640px;
  margin: 0;
  color: var(--muted);
  font-size: 1.02rem;
  line-height: 1.68;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.hero-btn {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 0 15px;
  font-weight: 800;
  text-decoration: none;
}

.hero-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.hero-btn-primary {
  background: var(--green);
  color: white;
}

.hero-btn-secondary {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
}

.ops-preview {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
  animation: float-in 0.86s ease 0.08s both;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid var(--line);
  padding: 12px 14px;
  background: var(--surface-soft);
}

.preview-toolbar span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--green);
}

.preview-toolbar span:nth-child(2) {
  background: var(--amber);
}

.preview-toolbar span:nth-child(3) {
  background: var(--blue);
}

.preview-toolbar strong {
  margin-left: auto;
  color: var(--muted);
  font-size: 0.76rem;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}

.preview-panel {
  display: grid;
  gap: 10px;
  min-height: 120px;
  align-content: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface-raised);
}

.preview-panel-large {
  grid-column: 1 / -1;
  min-height: 220px;
}

.preview-panel-head,
.signal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-kicker,
.preview-panel span,
.signal-row span {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.panel-pill {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 0.74rem;
  font-weight: 900;
}

.panel-pill.is-ok {
  background: var(--green-soft);
  color: var(--green);
}

.status-lines {
  display: grid;
  gap: 9px;
  padding: 16px 0 10px;
}

.line {
  height: 10px;
  border-radius: 999px;
  background: var(--surface-soft);
  transform-origin: left center;
  animation: line-fill 0.8s ease both;
}

.line.is-long {
  width: 92%;
  animation-delay: 0.34s;
}

.line.is-mid {
  width: 72%;
  animation-delay: 0.44s;
}

.line.is-short {
  width: 48%;
  animation-delay: 0.54s;
}

.signal-row {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.signal-row strong,
.preview-panel strong {
  color: var(--text);
}

.preview-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--blue-soft);
  color: var(--blue);
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  animation: rise-in 0.62s ease 0.18s both;
}

.workflow-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.16s ease,
    transform 0.16s ease;
}

.workflow-card:hover {
  border-color: rgba(31, 122, 77, 0.35);
  transform: translateY(-4px);
}

.workflow-icon {
  width: 22px;
  height: 22px;
  color: var(--green);
}

.workflow-card h2 {
  margin: 0 0 5px;
  color: var(--text);
  font-size: 0.98rem;
  letter-spacing: 0;
}

.workflow-card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.workflow-arrow {
  color: var(--muted);
}

.landing-section {
  display: grid;
  gap: 26px;
  justify-items: center;
  padding: 86px 0 0;
  text-align: center;
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.section-heading {
  display: grid;
  gap: 12px;
  justify-items: center;
  max-width: 680px;
  margin-bottom: 0;
  text-align: center;
}

.section-heading-narrow {
  max-width: 680px;
}

.section-heading h2,
.landing-cta h2 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.7rem, 4vw, 2.55rem);
  line-height: 1.05;
  letter-spacing: 0;
}

.section-heading p:not(.eyebrow) {
  margin: 0;
  color: var(--muted);
  font-size: 0.98rem;
  line-height: 1.7;
}

.eyebrow.is-blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.eyebrow.is-amber {
  background: var(--amber-soft);
  color: var(--amber);
}

.motivation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.assurance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.assurance-item {
  display: grid;
  gap: 12px;
  min-height: 210px;
  align-content: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
  background: var(--surface);
  text-align: left;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.assurance-item:hover {
  border-color: rgba(31, 122, 77, 0.3);
  box-shadow: var(--shadow-soft);
  transform: translateY(-4px);
}

.assurance-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--green-soft);
  color: var(--green);
}

.assurance-item:nth-child(2) .assurance-icon {
  background: var(--blue-soft);
  color: var(--blue);
}

.assurance-item:nth-child(3) .assurance-icon {
  background: var(--amber-soft);
  color: var(--amber);
}

.assurance-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.assurance-item h3 {
  margin: 0;
  color: var(--text);
  font-size: 1rem;
  letter-spacing: 0;
}

.assurance-item p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.62;
}

.metrics-strip {
  display: grid;
  gap: 18px;
  padding: 72px 0 0;
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 18px;
}

.metric-card strong {
  color: var(--text);
  font-size: clamp(1.25rem, 3vw, 1.9rem);
  line-height: 1.1;
}

.metric-card span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 800;
}

.motivation-card {
  display: grid;
  gap: 12px;
  align-content: start;
  justify-items: center;
  min-height: 220px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
  background: var(--surface);
  text-align: center;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.motivation-card:hover {
  border-color: rgba(31, 122, 77, 0.3);
  box-shadow: 0 18px 42px rgba(20, 34, 27, 0.08);
  transform: translateY(-4px);
}

.motivation-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--green-soft);
  color: var(--green);
  animation: icon-breathe 2.8s ease-in-out infinite;
}

.motivation-card:nth-child(2) .motivation-icon {
  background: var(--blue-soft);
  color: var(--blue);
}

.motivation-card:nth-child(3) .motivation-icon {
  background: var(--amber-soft);
  color: var(--amber);
}

.motivation-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.motivation-card h3,
.runbook-item h3 {
  margin: 0;
  color: var(--text);
  font-size: 1rem;
  letter-spacing: 0;
}

.motivation-card p,
.runbook-item p,
.faq-item p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.62;
}

.runbook-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

.runbook-list {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 auto;
}

.runbook-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: start;
  justify-content: flex-start;
  text-align: left;
  padding: 20px;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.runbook-item:hover {
  background: rgba(255, 255, 255, 0.48);
  transform: translateY(-2px);
}

.runbook-item .runbook-item-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.runbook-item span {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--surface);
  color: var(--blue);
  font-family: "DM Mono", monospace;
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--line);
}

.faq-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

.faq-list {
  display: grid;
  gap: 10px;
  width: min(760px, 100%);
  margin: 0 auto;
}

.faq-item {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.faq-item:hover,
.faq-item[open] {
  border-color: rgba(31, 122, 77, 0.28);
  box-shadow: 0 14px 34px rgba(20, 34, 27, 0.07);
  transform: translateY(-2px);
}

.faq-item summary {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  min-height: 58px;
  align-items: center;
  justify-items: start;
  cursor: pointer;
  list-style: none;
  padding: 0 20px;
  color: var(--text);
  font-weight: 800;
  text-align: left;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-item summary :deep(svg) {
  position: absolute;
  right: 16px;
  width: 16px;
  height: 16px;
  color: var(--green);
  transition: transform 0.16s ease;
}

.faq-item[open] summary :deep(svg) {
  transform: rotate(45deg);
}

.faq-item p {
  border-top: 1px solid var(--line);
  padding: 14px 16px 16px;
}

.landing-cta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin: 86px 0 42px;
  border-radius: 8px;
  padding: 28px;
  background:
    linear-gradient(
      135deg,
      rgba(223, 244, 232, 0.92),
      rgba(226, 238, 249, 0.9)
    ),
    var(--surface-soft);
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.landing-cta > div {
  display: grid;
  gap: 10px;
  max-width: 690px;
}

.landing-cta a {
  height: fit-content;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes section-rise {
  from {
    opacity: 0;
    transform: translateY(22px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes line-fill {
  from {
    transform: scaleX(0.18);
  }

  to {
    transform: scaleX(1);
  }
}

@keyframes icon-breathe {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@media (max-width: 980px) {
  .landing-hero,
  .quick-links,
  .motivation-grid,
  .assurance-grid,
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .landing-hero {
    min-height: auto;
    padding: 26px 0;
  }

  .landing-section {
    padding-top: 58px;
  }

  .landing-cta {
    margin-top: 58px;
  }

  .metrics-strip {
    padding-top: 58px;
  }
}

@media (max-width: 560px) {
  .landing-page {
    width: min(100% - 24px, 680px);
    padding-top: 24px;
  }

  .hero-btn,
  .workflow-card {
    width: 100%;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .section-heading h2,
  .landing-cta h2 {
    font-size: 1.65rem;
  }

  .runbook-item {
    padding-inline: 4px;
  }

  .faq-item summary {
    padding: 0 40px;
  }

  .landing-cta {
    padding: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-hero,
  .ops-preview,
  .quick-links,
  .landing-section,
  .metrics-strip,
  .landing-cta,
  .line,
  .motivation-icon {
    animation: none;
  }

  .workflow-card,
  .motivation-card,
  .runbook-item,
  .faq-item {
    transition: none;
  }
}
</style>
