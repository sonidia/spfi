<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="hero-copy">
        <p class="eyebrow is-ok">Shopify Operations Console</p>
        <h1>Telescope the storefront from one desk</h1>
        <p class="hero-sub">
          A compact workspace for connecting shops, rotating tokens, checking
          public store status, and reading Google Sheet data without jumping
          between tools.
        </p>
        <div class="hero-actions">
          <NuxtLink class="hero-btn hero-btn-primary" to="/manager">
            <IconsBulking />
            Open Manager
          </NuxtLink>
          <NuxtLink class="hero-btn hero-btn-secondary" to="/status">
            <IconsCheck />
            Check Status
          </NuxtLink>
        </div>
      </div>

      <div class="ops-preview" aria-label="Operations preview">
        <div class="preview-toolbar">
          <span />
          <span />
          <span />
          <strong>Live workspace</strong>
        </div>
        <div class="preview-grid">
          <div class="preview-panel preview-panel-large">
            <div class="preview-panel-head">
              <span class="panel-kicker">Batch status</span>
              <span class="panel-pill is-ok">Alive 18</span>
            </div>
            <div class="status-lines">
              <span class="line is-long" />
              <span class="line is-mid" />
              <span class="line is-short" />
            </div>
            <div class="signal-row">
              <span>HTTP</span>
              <strong>200 OK</strong>
            </div>
            <div class="signal-row">
              <span>Products endpoint</span>
              <strong>JSON</strong>
            </div>
          </div>

          <div class="preview-panel">
            <div class="preview-icon"><IconsRefresh /></div>
            <span>Token rotation</span>
            <strong>Ready</strong>
          </div>

          <div class="preview-panel">
            <div class="preview-icon"><IconsCopy /></div>
            <span>Sheet lookup</span>
            <strong>4 tabs</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="quick-links" aria-label="Primary workflows">
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
        <p class="eyebrow">Motivation</p>
        <h2>Keep repetitive Shopify ops calm, visible, and fast.</h2>
        <p>
          Spfi is built for the small but expensive moments: switching between
          stores, checking whether storefronts are reachable, and pulling the
          right sheet data while orders keep moving.
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

    <section class="runbook-section landing-section">
      <div class="section-heading section-heading-narrow">
        <p class="eyebrow is-blue">Daily Flow</p>
        <h2>A tighter loop from access to verification.</h2>
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
        <p class="eyebrow is-amber">FAQ</p>
        <h2>Questions before you open the workspace.</h2>
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

    <section class="landing-cta" aria-label="Open workspace">
      <div>
        <p class="eyebrow">Ready Desk</p>
        <h2>Start with the manager, then branch into the task you need.</h2>
      </div>
      <NuxtLink class="hero-btn hero-btn-primary" to="/manager">
        <IconsArrowRight />
        Open Manager
      </NuxtLink>
    </section>

    <AppFooter />
  </main>
</template>

<script setup lang="ts">
import IconsLandingClean from "~/components/icons/landing/Clean.vue";
import IconsLandingFlash from "~/components/icons/landing/Flash.vue";
import IconsLandingUsefull from "~/components/icons/landing/Usefull.vue";

const quickLinks = [
  {
    to: "/setup",
    title: "Setup Guide",
    description: "Follow the app creation and credential checklist.",
    icon: "IconsHero",
  },
  {
    to: "/manager",
    title: "Shop Management",
    description: "Add stores, rotate tokens, and test proxies.",
    icon: "IconsBulking",
  },
  {
    to: "/sheet",
    title: "Sheets",
    description: "Open sheet tabs and inspect rows quickly.",
    icon: "IconsCopy",
  },
  {
    to: "/status",
    title: "Status Checker",
    description: "Batch check Shopify storefront availability.",
    icon: "IconsCheck",
  },
];

const motivationItems = [
  {
    title: "Fewer tab jumps",
    description:
      "Move between setup, profiles, payments, sheets, and status checks from one predictable place.",
    icon: IconsLandingFlash,
  },
  {
    title: "Cleaner store checks",
    description:
      "Run quick storefront checks with proxy context so blocked or unhealthy shops are easier to spot.",
    icon: IconsLandingClean,
  },
  {
    title: "Less manual copywork",
    description:
      "Use saved shop profiles and sheet lookups to reduce the repeated handoff work around orders.",
    icon: IconsLandingUsefull,
  },
];

const runbookSteps = [
  {
    step: "01",
    title: "Connect the shop",
    description:
      "Add store credentials, prepare tokens, and keep profile data ready for follow-up tasks.",
  },
  {
    step: "02",
    title: "Check the surface",
    description:
      "Confirm storefront access and endpoint responses before spending time on deeper order work.",
  },
  {
    step: "03",
    title: "Use the source data",
    description:
      "Open sheet tabs, inspect rows, and move into product, order, or payment workflows as needed.",
  },
];

const faqItems = [
  {
    question: "What should I open first?",
    answer:
      "Start with Manager when you are preparing stores or credentials. Use Status when you only need a fast storefront health check.",
  },
  {
    question: "Does this replace Shopify Admin?",
    answer:
      "No. It keeps the repetitive operational checks nearby, then links your day-to-day work back to the specific shop data you need.",
  },
  {
    question: "Where does sheet data fit?",
    answer:
      "The Sheet page helps inspect connected Google Sheet tabs and rows when order or product work depends on spreadsheet data.",
  },
  {
    question: "Can I use it for batch status checks?",
    answer:
      "Yes. The Status Checker is designed for running multiple storefront availability checks in one focused view.",
  },
];
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
  background: #fff;
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
  .motivation-grid {
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
