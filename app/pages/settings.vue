<script setup lang="ts">
import {
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "@lucide/vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useToastStore } from "~/stores/toast";

definePageMeta({ layout: false });

const { t } = useLocalization();
const credentialVault = useCredentialVaultStore();
const toast = useToastStore();

const endpoint = ref("");
const apiKey = ref("");
const showApiKey = ref(false);
const isSaving = ref(false);
const formError = ref("");

const isConfigured = computed(
  () =>
    Boolean(credentialVault.trackingSettings.baseUrl) &&
    Boolean(credentialVault.trackingSettings.apiKey),
);

const hasChanges = computed(
  () =>
    endpoint.value.trim() !== credentialVault.trackingSettings.baseUrl ||
    apiKey.value.trim() !== credentialVault.trackingSettings.apiKey,
);

watch(
  () => [
    credentialVault.isUnlocked,
    credentialVault.trackingSettings.baseUrl,
    credentialVault.trackingSettings.apiKey,
  ],
  ([isUnlocked]) => {
    if (!isUnlocked) return;
    endpoint.value = credentialVault.trackingSettings.baseUrl;
    apiKey.value = credentialVault.trackingSettings.apiKey;
    formError.value = "";
  },
  { immediate: true },
);

async function saveSettings() {
  const normalizedEndpoint = endpoint.value.trim();
  const normalizedApiKey = apiKey.value.trim();
  formError.value = "";

  if (!normalizedEndpoint || !normalizedApiKey) {
    formError.value = t("settings.required");
    return;
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(normalizedEndpoint);
    if (
      parsedEndpoint.protocol !== "https:" ||
      parsedEndpoint.username ||
      parsedEndpoint.password ||
      (parsedEndpoint.port && parsedEndpoint.port !== "443")
    ) {
      throw new Error("Invalid HTTPS endpoint");
    }
  } catch {
    formError.value = t("settings.httpsRequired");
    return;
  }

  isSaving.value = true;
  try {
    parsedEndpoint.hash = "";
    await credentialVault.saveTrackingSettings({
      baseUrl: parsedEndpoint.toString(),
      apiKey: normalizedApiKey,
    });
    toast.success(t("settings.saved"));
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : t("settings.required");
  } finally {
    isSaving.value = false;
  }
}

function clearSettings() {
  if (!confirm(t("settings.clearConfirm"))) return;

  try {
    credentialVault.removeTrackingSettings();
    endpoint.value = "";
    apiKey.value = "";
    showApiKey.value = false;
    formError.value = "";
    toast.success(t("settings.cleared"));
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : t("settings.required");
  }
}
</script>

<template>
  <main class="settings-page">
    <PageHeader :title="t('settings.title')" :sub="t('settings.subtitle')">
      <Settings2 />
      <template #actions>
        <span
          class="configuration-status"
          :class="{ 'is-configured': isConfigured }"
        >
          <span class="status-dot" aria-hidden="true"></span>
          {{
            isConfigured
              ? t("settings.configured")
              : t("settings.notConfigured")
          }}
        </span>
      </template>
    </PageHeader>

    <div class="settings-grid">
      <section class="settings-card provider-card">
        <div class="card-heading">
          <div class="card-icon"><KeyRound /></div>
          <div>
            <h2>{{ t("settings.providerTitle") }}</h2>
            <p>{{ t("settings.providerDescription") }}</p>
          </div>
        </div>

        <div class="settings-form">
          <label class="field">
            <span class="field-label">
              <Link2 />
              {{ t("settings.endpointLabel") }}
            </span>
            <input
              v-model="endpoint"
              type="url"
              inputmode="url"
              autocomplete="url"
              spellcheck="false"
              maxlength="2048"
              :placeholder="t('settings.endpointPlaceholder')"
            />
            <span class="field-hint">{{ t("settings.endpointHint") }}</span>
          </label>

          <label class="field">
            <span class="field-label">
              <KeyRound />
              {{ t("settings.apiKeyLabel") }}
            </span>
            <span class="secret-input">
              <input
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
                maxlength="4096"
                :placeholder="t('settings.apiKeyPlaceholder')"
              />
              <button
                type="button"
                class="secret-toggle"
                :aria-label="
                  showApiKey
                    ? t('settings.hideApiKey')
                    : t('settings.showApiKey')
                "
                :title="
                  showApiKey
                    ? t('settings.hideApiKey')
                    : t('settings.showApiKey')
                "
                @click="showApiKey = !showApiKey"
              >
                <EyeOff v-if="showApiKey" />
                <Eye v-else />
              </button>
            </span>
            <span class="field-hint">{{ t("settings.apiKeyHint") }}</span>
          </label>

          <p v-if="formError" class="form-error" role="alert">
            {{ formError }}
          </p>

          <div class="form-actions">
            <BaseButton
              variant="danger-ghost"
              size="medium"
              :disabled="!isConfigured || isSaving"
              @click="clearSettings"
            >
              <template #icon><Trash2 /></template>
              {{ t("settings.clear") }}
            </BaseButton>
            <BaseButton
              variant="primary"
              size="medium"
              :loading="isSaving"
              :disabled="!hasChanges"
              @click="saveSettings"
            >
              <template #icon><Save /></template>
              {{ t("settings.save") }}
            </BaseButton>
          </div>
        </div>
      </section>

      <aside class="settings-card security-card">
        <div class="security-icon"><ShieldCheck /></div>
        <h2>{{ t("settings.securityTitle") }}</h2>
        <p>{{ t("settings.securityDescription") }}</p>
        <ul>
          <li>{{ t("settings.localOnly") }}</li>
          <li>{{ t("settings.encrypted") }}</li>
          <li>{{ t("settings.noEnv") }}</li>
        </ul>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.settings-page {
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: 28px 20px 56px;
}

.configuration-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}

.configuration-status.is-configured {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.configuration-status.is-configured .status-dot {
  background: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 14%, transparent);
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.settings-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.card-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.card-icon,
.security-icon {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 9px;
  background: var(--green-soft);
  color: var(--green);
}

.card-icon {
  width: 36px;
  height: 36px;
}

.card-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.card-heading h2,
.security-card h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
  line-height: 1.35;
}

.card-heading p,
.security-card p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.settings-form {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.field {
  display: grid;
  gap: 7px;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.field-label :deep(svg) {
  width: 14px;
  height: 14px;
  color: var(--green);
}

.field input {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 16%, transparent);
  outline: none;
}

.field-hint {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}

.secret-input {
  position: relative;
  display: block;
}

.secret-input input {
  padding-right: 44px;
}

.secret-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.secret-toggle:hover {
  background: var(--surface-soft);
  color: var(--text);
}

.secret-toggle :deep(svg) {
  width: 16px;
  height: 16px;
}

.form-error {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
  border-radius: 7px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.security-card {
  padding: 20px;
}

.security-icon {
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
}

.security-icon :deep(svg) {
  width: 23px;
  height: 23px;
}

.security-card ul {
  display: grid;
  gap: 9px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.security-card li {
  position: relative;
  padding-left: 17px;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
}

.security-card li::before {
  content: "";
  position: absolute;
  top: 7px;
  left: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .settings-page {
    padding-inline: 14px;
  }

  .form-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .form-actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
