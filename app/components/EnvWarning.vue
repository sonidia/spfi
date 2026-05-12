<script setup lang="ts">
const config = useRuntimeConfig();

const missingKeys = computed(() => {
  const missing: string[] = [];

  Object.entries(config.public).forEach(([key, value]) => {
    if (
      (key.toLowerCase().includes("url") ||
        key.toLowerCase().includes("key")) &&
      !value
    ) {
      const envKey = `NUXT_PUBLIC_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
      missing.push(envKey);
    }
  });

  if (config.tracktacoApiKey === "") {
    missing.push("NUXT_TRACKTACO_API_KEY");
  }

  return missing;
});

const hasMissingKeys = computed(() => missingKeys.value.length > 0);

const reloadPage = () => {
  if (import.meta.client) {
    window.location.reload();
  }
};
</script>

<template>
  <div v-if="hasMissingKeys" class="env-warning-overlay">
    <div class="env-warning-card">
      <div class="env-warning-header">
        <div class="warning-icon-wrapper">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
            />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <div class="header-text">
          <h2>Missing System Configuration</h2>
          <p>Please update your environment variables to continue</p>
        </div>
      </div>

      <div class="env-warning-body">
        <div class="instruction">
          <p>
            The following variables are not defined in the
            <code>.env</code> file:
          </p>
        </div>

        <ul class="missing-keys-list">
          <li v-for="key in missingKeys" :key="key">
            <span class="dot"></span>
            <code class="key-name">{{ key }}</code>
          </li>
        </ul>

        <div class="env-warning-footer">
          <div class="info-note">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>After configuration, please restart the dev server.</span>
          </div>
          <button @click="reloadPage" class="btn-reload">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.env-warning-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  padding: 20px;
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    sans-serif;
}

.env-warning-card {
  background: var(--bg-card, #ffffff);
  width: 100%;
  max-width: 540px;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  border: 1px solid rgba(239, 68, 68, 0.2);
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.env-warning-header {
  background: #ef4444;
  padding: 32px;
  color: white;
  display: flex;
  align-items: center;
  gap: 20px;
}

.warning-icon-wrapper {
  background: rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-text h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.header-text p {
  margin: 4px 0 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.env-warning-body {
  padding: 32px;
  background: #fff;
}

.instruction p {
  color: #64748b;
  font-size: 15px;
  margin-bottom: 20px;
}

.instruction code {
  background: #f1f5f9;
  color: #ef4444;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.missing-keys-list {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.missing-keys-list li {
  background: #fef2f2;
  border: 1px solid #fee2e2;
  padding: 14px 18px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s;
}

.missing-keys-list li:hover {
  transform: translateX(4px);
}

.dot {
  width: 6px;
  height: 6px;
  background: #ef4444;
  border-radius: 50%;
}

.key-name {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 13.5px;
  color: #b91c1c;
  font-weight: 700;
  word-break: break-all;
}

.env-warning-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid #f1f5f9;
}

.info-note {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
}

.btn-reload {
  background: #0f172a;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-reload:hover {
  background: #1e293b;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.btn-reload:active {
  transform: translateY(0);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .env-warning-body {
    background: #0f172a;
  }

  .instruction p {
    color: #94a3b8;
  }

  .instruction code {
    background: #1e293b;
  }

  .missing-keys-list li {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.1);
  }

  .key-name {
    color: #fca5a5;
  }

  .env-warning-footer {
    border-top-color: #1e293b;
  }

  .btn-reload {
    background: #fff;
    color: #0f172a;
  }
}
</style>
