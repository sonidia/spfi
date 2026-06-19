<template>
  <div class="intro" aria-label="Shopify status checker">
    <div class="intro-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path
          d="M13 19h22v17a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V19Z"
          fill="currentColor"
          opacity=".16"
        />
        <path
          d="M16 19h16l3 21H13l3-21Zm5 0c0-4 2-7 5-7s5 3 5 7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
        <path
          d="m19 30 4 4 8-10"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
        />
      </svg>
    </div>
    <div class="intro-copy">
      <p class="app-title">Shop Status</p>
      <p class="app-desc">Public Shopify diagnostics checker</p>
    </div>
  </div>
</template>

<style scoped>
.intro {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.intro-mark {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(223, 244, 232, 0.88), rgba(226, 238, 249, 0.72));
  color: var(--green);
}

.intro-mark svg {
  width: 34px;
  height: 34px;
  filter: drop-shadow(0 8px 14px rgba(39, 92, 145, 0.16));
}

.intro-copy {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.app-title,
.app-desc {
  margin: 0;
}

.app-title {
  color: var(--green);
  font-size: 1.06rem;
  font-weight: 900;
  line-height: 1.1;
}

.app-desc {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.38;
  white-space: nowrap;
}
</style>
