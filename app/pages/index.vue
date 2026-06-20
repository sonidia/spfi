<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="hero-copy">
        <p class="eyebrow">Shopify Operations Console</p>
        <h1>Run setup, sheets, payments, and status checks from one desk.</h1>
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
  </main>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.landing-page {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
}

.landing-hero {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.8fr);
  min-height: calc(100vh - 180px);
  align-items: center;
  gap: 42px;
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
}

.line.is-long {
  width: 92%;
}

.line.is-mid {
  width: 72%;
}

.line.is-short {
  width: 48%;
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
  transform: translateY(-2px);
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

@media (max-width: 980px) {
  .landing-hero,
  .quick-links {
    grid-template-columns: 1fr;
  }

  .landing-hero {
    min-height: auto;
    padding: 26px 0;
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
}
</style>
