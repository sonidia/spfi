<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { isCredentialRouteWhitelisted } from "~/utils/credentialRouteAccess";

const vault = useCredentialVaultStore();
const route = useRoute();
const { t } = useLocalization();
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);

const isSetup = computed(() => vault.needsSetup);
const shouldShowUnlock = computed(
  () =>
    vault.isInitialized &&
    !vault.isUnlocked &&
    !isCredentialRouteWhitelisted(route.path),
);
const canSubmit = computed(() => {
  if (password.value.length < 4) return false;
  return !isSetup.value || password.value === confirmPassword.value;
});

onMounted(() => vault.initialize());

async function submit() {
  if (!canSubmit.value || vault.isBusy) return;
  const success = await vault.unlock(password.value);
  if (success) {
    password.value = "";
    confirmPassword.value = "";
  }
}
</script>

<template>
  <Transition name="vault-fade">
    <div
      v-if="shouldShowUnlock"
      class="vault-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-title"
    >
      <form class="vault-card" @submit.prevent="submit">
        <p class="vault-eyebrow">{{ t("vault.eyebrow") }}</p>
        <h1 id="vault-title">
          {{ isSetup ? t("vault.setupTitle") : t("vault.unlockTitle") }}
        </h1>
        <p class="vault-description">
          {{
            isSetup ? t("vault.setupDescription") : t("vault.unlockDescription")
          }}
        </p>

        <label class="vault-field">
          <span>{{ t("vault.passwordLabel") }}</span>
          <div class="vault-input-wrap">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              minlength="4"
              autofocus
              :placeholder="t('vault.passwordPlaceholder')"
            />
            <button
              type="button"
              class="vault-reveal"
              :aria-label="
                showPassword ? t('vault.hidePassword') : t('vault.showPassword')
              "
              @click="showPassword = !showPassword"
            >
              {{
                showPassword ? t("vault.hidePassword") : t("vault.showPassword")
              }}
            </button>
          </div>
        </label>

        <label v-if="isSetup" class="vault-field">
          <span>{{ t("vault.confirmPasswordLabel") }}</span>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="4"
            :placeholder="t('vault.confirmPasswordPlaceholder')"
          />
        </label>

        <p v-if="vault.error" class="vault-error" role="alert">
          {{ vault.error }}
        </p>
        <p
          v-else-if="isSetup && confirmPassword && password !== confirmPassword"
          class="vault-error"
        >
          {{ t("vault.mismatch") }}
        </p>

        <button
          class="vault-submit"
          type="submit"
          :disabled="!canSubmit || vault.isBusy"
        >
          {{
            vault.isBusy
              ? t("vault.submitSecuring")
              : isSetup
                ? t("vault.submitCreate")
                : t("vault.submitUnlock")
          }}
        </button>
      </form>
    </div>
  </Transition>
</template>

<style scoped>
.vault-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(61, 127, 92, 0.22), transparent 38%),
    rgba(13, 24, 18, 0.82);
  backdrop-filter: blur(16px);
}

.vault-card {
  width: min(100%, 430px);
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 30px 90px rgba(7, 19, 12, 0.34);
}

.vault-eyebrow {
  margin-bottom: 6px;
  color: var(--green);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vault-card h1 {
  color: var(--text);
  font-size: clamp(20px, 2vw, 28px);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.vault-description {
  margin: 12px 0 24px;
  color: var(--text-sub);
  line-height: 1.6;
}

.vault-field {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

.vault-field > span {
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.vault-field input {
  width: 100%;
  min-height: 46px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  transition:
    border-color 0.16s,
    box-shadow 0.16s;
}

.vault-field input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(31, 122, 77, 0.13);
}

.vault-input-wrap {
  position: relative;
}

.vault-input-wrap input {
  padding-right: 64px;
}

.vault-reveal {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  padding: 5px 7px;
  border: 0;
  background: transparent;
  color: var(--green);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.vault-error {
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
}

.vault-submit {
  width: 100%;
  min-height: 46px;
  margin-top: 20px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #1f7a4d, #236b72);
  color: white;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(31, 122, 77, 0.2);
}

.vault-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.vault-fade-enter-active,
.vault-fade-leave-active {
  transition: opacity 0.18s ease;
}

.vault-fade-enter-from,
.vault-fade-leave-to {
  opacity: 0;
}
</style>
