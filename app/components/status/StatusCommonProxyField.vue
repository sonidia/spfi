<script setup lang="ts">
import { getSocks5ProxyInputError } from "~/composables/useSocks5ProxyInput";

interface ProxyLocationInfo {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  isp?: string;
  org?: string;
  timezone?: string;
}

interface ProxyCheckError {
  message?: string;
}

interface ProxyCheckResponse {
  success: boolean;
  ip?: string;
  duration?: number;
  location?: ProxyLocationInfo;
  error?: string | ProxyCheckError;
}

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const checking = ref(false);
const result = ref<ProxyCheckResponse | null>(null);
const errorMessage = ref("");
const { t } = useLocalization();

const proxyValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const resultLocation = computed(() => {
  const location = result.value?.location;
  const parts = [location?.city, location?.region, location?.country].filter(Boolean);

  return parts.length ? parts.join(", ") : "";
});

watch(
  () => props.modelValue,
  () => {
    result.value = null;
    errorMessage.value = "";
  },
);

async function checkProxy() {
  if (checking.value) {
    return;
  }

  const proxy = props.modelValue.trim();
  const proxyError = getSocks5ProxyInputError(proxy);

  result.value = null;
  errorMessage.value = "";

  if (proxyError) {
    errorMessage.value = proxyError;
    return;
  }

  checking.value = true;

  try {
    const data = await $fetch<ProxyCheckResponse>("/api/check-proxy", {
      method: "POST",
      body: { proxy },
    });

    result.value = data;
    errorMessage.value = data.success
      ? ""
      : getProxyCheckErrorMessage(data.error, t("status.proxyCheckFailed"));
  } catch (error) {
    errorMessage.value = getErrorMessage(error, t("status.proxyCheckFailed"));
  } finally {
    checking.value = false;
  }
}

function getProxyCheckErrorMessage(
  error: ProxyCheckResponse["error"],
  fallback: string,
) {
  if (typeof error === "string" && error) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  const data =
    typeof error === "object" && error && "data" in error
      ? (error as { data?: { message?: unknown; statusMessage?: unknown } }).data
      : undefined;

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (typeof data?.statusMessage === "string") {
    return data.statusMessage;
  }

  return error instanceof Error ? error.message : fallback;
}
</script>

<template>
  <div class="proxy-field">
    <label for="common-proxy">{{ t("status.commonProxyLabel") }}</label>

    <div class="proxy-check-row">
      <input
        id="common-proxy"
        v-model="proxyValue"
        autocomplete="off"
        placeholder="host:port:user:pass"
      />

      <BaseButton
        size="large"
        variant="primary"
        :disabled="checking"
        @click="checkProxy"
      >
        <template #icon>
          <IconsSync v-if="checking" class="spin-icon" />
          <IconsCheck v-else />
        </template>
        {{ checking ? t("status.checkingProxy") : t("status.checkProxy") }}
      </BaseButton>

      <div
        v-if="result?.success || errorMessage"
        class="proxy-check-result"
        :class="{ 'is-error': !result?.success }"
      >
        <template v-if="result?.success">
          <strong>{{ t("status.live") }}</strong>
          <span>{{ result.ip || result.location?.ip || t("status.unknownIp") }}</span>
          <span v-if="resultLocation">{{ resultLocation }}</span>
          <span v-if="result.location?.isp">{{ result.location.isp }}</span>
          <span v-if="result.duration">{{ result.duration }}ms</span>
        </template>
        <template v-else>
          <strong>{{ t("status.failed") }}</strong>
          <span>{{ errorMessage }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proxy-field {
  display: grid;
  gap: 6px;
}

.proxy-field label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 600;
}

.proxy-check-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 0.85fr);
  gap: 8px;
  align-items: center;
}

.proxy-check-row input {
  min-height: var(--control-height-lg);
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  padding: 0 12px;
  color: var(--text);
  background: var(--surface-soft);
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}

.proxy-check-row input:focus {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.spin-icon {
  animation: spin 0.8s linear infinite;
}

.proxy-check-result {
  display: flex;
  min-height: var(--control-height-lg);
  min-width: 0;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  border: 1px solid rgba(31, 122, 77, 0.18);
  border-radius: var(--control-radius);
  padding: 0 10px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.proxy-check-result.is-error {
  border-color: rgba(180, 49, 43, 0.22);
  background: var(--red-soft);
  color: var(--red);
}

.proxy-check-result span {
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 820px) {
  .proxy-check-row {
    grid-template-columns: 1fr;
  }

  .proxy-check-row button,
  .proxy-check-result {
    width: 100%;
  }
}
</style>
