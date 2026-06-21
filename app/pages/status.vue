<script setup lang="ts">
import {
  getSocks5ProxyInputError,
  isSocks5ProxyInput,
} from "~/composables/useSocks5ProxyInput";
import type {
  BatchStatus,
  CheckPlatform,
  CheckSeverity,
  ProxyMode,
  StoreCheckResult,
  StoreLifecycleStatus,
} from "~~/types/store-status";

definePageMeta({ layout: false });

interface BatchCheckInput {
  target: string;
  proxy: string;
  lineNumber: number;
}

interface BatchCheckRow extends BatchCheckInput {
  id: number;
  platform: CheckPlatform;
  mode: ProxyMode;
  status: BatchStatus;
  result?: StoreCheckResult;
  errorMessage?: string;
}

const route = useRoute();

const routeTarget = computed<string>(() => {
  const targetQuery = route.query.target;

  if (Array.isArray(targetQuery)) {
    return targetQuery[0] || "";
  }

  return typeof targetQuery === "string" ? targetQuery : "";
});

const result = ref<StoreCheckResult | null>(null);
const batchInput = ref<string>(routeTarget.value);
const selectedPlatform = ref<CheckPlatform>("shopify");
const proxyMode = ref<ProxyMode>("no-proxy");
const commonProxy = ref("");
const batchRows = ref<BatchCheckRow[]>([]);
const batchErrorMessage = ref("");
const isBatchChecking = ref(false);
const activeBatchRowId = ref<number | null>(null);
const batchAbortController = shallowRef<AbortController | null>(null);
const batchTextareaRef = ref<HTMLTextAreaElement | null>(null);
const batchTextareaScrollTop = ref(0);
const checkingLineNumbers = ref<number[]>([]);
const focusedCheckingLineNumber = ref<number | null>(null);
const expandedCheckKeys = ref<Set<string>>(new Set());

const severityLabel: Record<CheckSeverity, string> = {
  ok: "OK",
  warning: "Review",
  danger: "Risk",
  neutral: "Unknown",
};

const proxyModeOptions: { value: ProxyMode; label: string }[] = [
  { value: "common-proxy", label: "Common proxy" },
  { value: "separate-proxy", label: "Separate proxy" },
  { value: "no-proxy", label: "No proxy" },
];

function setProxyMode(mode: ProxyMode) {
  proxyMode.value = mode;
}

const batchPlaceholder = computed(() => {
  const examples = ["shop-a.myshopify.com", "shop-b.com", "example.com"];

  if (proxyMode.value === "separate-proxy") {
    return examples
      .slice(0, 2)
      .map((example, index) => `127.0.0.${index + 1}:1080:user:pass ${example}`)
      .join("\n");
  }

  return examples.join("\n");
});

const batchStats = computed(() => {
  const total = batchRows.value.length;
  const done = batchRows.value.filter((row) => row.status === "done").length;
  const errors = batchRows.value.filter((row) => row.status === "error").length;
  const checking = batchRows.value.filter(
    (row) => row.status === "checking",
  ).length;
  const alive = batchRows.value.filter(
    (row) => row.result?.storeStatus === "alive",
  ).length;
  const dead = batchRows.value.filter(
    (row) => row.result?.storeStatus === "dead",
  ).length;

  return {
    total,
    done,
    errors,
    checking,
    alive,
    dead,
  };
});

const batchCompletedCount = computed(
  () => batchStats.value.done + batchStats.value.errors,
);

const batchProgressPercent = computed(() =>
  batchStats.value.total
    ? Math.round((batchCompletedCount.value / batchStats.value.total) * 100)
    : 0,
);

const batchProgressLabel = computed(() =>
  batchStats.value.total
    ? `${batchCompletedCount.value}/${batchStats.value.total} completed`
    : "Ready",
);

const isBatchProgressVisible = computed(
  () => isBatchChecking.value && batchStats.value.total > 0,
);

const isBatchProxyColumnVisible = computed(() =>
  batchRows.value.some((row) => row.mode !== "no-proxy"),
);

const batchInputLines = computed(() => batchInput.value.split(/\r?\n/));

const batchHighlightLayerStyle = computed(() => ({
  transform: `translateY(-${batchTextareaScrollTop.value}px)`,
}));

watch(result, () => {
  resetExpandedChecks();
});

function getErrorMessage(error: unknown, fallback: string) {
  const data =
    typeof error === "object" && error && "data" in error
      ? (error as { data?: { message?: unknown; statusMessage?: unknown } })
          .data
      : undefined;

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (typeof data?.statusMessage === "string") {
    return data.statusMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

function fetchStoreCheck(
  nextTarget: string,
  proxy?: string,
  signal?: AbortSignal,
) {
  return $fetch<StoreCheckResult>("/api/status/check", {
    method: "POST",
    signal,
    body: {
      target: nextTarget,
      ...(proxy ? { proxy } : {}),
    },
  });
}

function parseBatchInput(): BatchCheckInput[] {
  const lines = batchInput.value
    .split(/\r?\n/)
    .map((line, index) => ({
      value: line.trim(),
      lineNumber: index + 1,
    }))
    .filter((line) => line.value && !line.value.startsWith("#"));

  if (!lines.length) {
    throw new Error("Paste at least 1 URL/domain to batch check.");
  }

  if (proxyMode.value === "common-proxy") {
    const proxy = commonProxy.value.trim();
    const proxyError = getSocks5ProxyInputError(proxy);

    if (proxyError) {
      throw new Error(proxyError);
    }

    return lines.map((line) => ({
      target: line.value,
      proxy,
      lineNumber: line.lineNumber,
    }));
  }

  if (proxyMode.value === "separate-proxy") {
    return lines.map((line) => {
      const parsed = parseSeparateProxyLine(line.value);

      if (!parsed.target || !parsed.proxy) {
        throw new Error(
          `Line ${line.lineNumber}: SOCKS5 proxy and URL/domain are required.`,
        );
      }

      const proxyError = getSocks5ProxyInputError(parsed.proxy);

      if (proxyError) {
        throw new Error(`Line ${line.lineNumber}: ${proxyError}`);
      }

      return {
        ...parsed,
        lineNumber: line.lineNumber,
      };
    });
  }

  return lines.map((line) => ({
    target: parseNoProxyTargetLine(line.value),
    proxy: "",
    lineNumber: line.lineNumber,
  }));
}

function parseNoProxyTargetLine(line: string) {
  const parsed = parseSeparateProxyLine(line);

  return parsed.target && isSocks5ProxyInput(parsed.proxy)
    ? parsed.target
    : line.trim();
}

function parseSeparateProxyLine(line: string) {
  const separators = ["|", "\t", ","];

  for (const separator of separators) {
    if (!line.includes(separator)) {
      continue;
    }

    const [proxyPart = "", ...targetParts] = line.split(separator);

    return {
      target: targetParts.join(separator).trim(),
      proxy: proxyPart.trim(),
    };
  }

  const [proxyPart = "", ...targetParts] = line.split(/\s+/);

  return {
    target: targetParts.join(" ").trim(),
    proxy: proxyPart.trim(),
  };
}

function getBatchRowProxyDisplay(row: BatchCheckRow) {
  if (!row.proxy) {
    return "Direct";
  }

  if (row.result?.proxyIp) {
    return row.result.proxyIp;
  }

  return row.status === "queued" || row.status === "checking"
    ? "Checking"
    : "Unknown";
}

function resetExpandedChecks() {
  expandedCheckKeys.value = new Set();
}

function isCheckExpanded(checkKey: string) {
  return expandedCheckKeys.value.has(checkKey);
}

function toggleCheckCard(checkKey: string) {
  const nextExpandedKeys = new Set(expandedCheckKeys.value);

  if (nextExpandedKeys.has(checkKey)) {
    nextExpandedKeys.delete(checkKey);
  } else {
    nextExpandedKeys.add(checkKey);
  }

  expandedCheckKeys.value = nextExpandedKeys;
}

function updateBatchRow(id: number, patch: Partial<BatchCheckRow>) {
  const rowIndex = batchRows.value.findIndex((row) => row.id === id);

  if (rowIndex === -1) {
    return;
  }

  const currentRow = batchRows.value[rowIndex];

  if (!currentRow) {
    return;
  }

  batchRows.value[rowIndex] = {
    ...currentRow,
    ...patch,
  };
}

function markPendingBatchRowsAsStopped() {
  batchRows.value = batchRows.value.map((row) =>
    row.status === "queued" || row.status === "checking"
      ? {
          ...row,
          status: "error",
          errorMessage: "Batch check stopped.",
        }
      : row,
  );
}

function syncBatchTextareaScroll(event: Event) {
  batchTextareaScrollTop.value = (
    event.currentTarget as HTMLTextAreaElement
  ).scrollTop;
}

function isBatchLineChecking(lineNumber: number) {
  return focusedCheckingLineNumber.value === lineNumber;
}

function focusCheckingLine(lineNumber: number) {
  checkingLineNumbers.value = Array.from(
    new Set([...checkingLineNumbers.value, lineNumber]),
  );
  focusedCheckingLineNumber.value = lineNumber;
  void nextTick(() => scrollBatchTextareaLineIntoView(lineNumber));
}

function blurCheckingLine(lineNumber: number) {
  checkingLineNumbers.value = checkingLineNumbers.value.filter(
    (checkingLineNumber) => checkingLineNumber !== lineNumber,
  );

  if (focusedCheckingLineNumber.value !== lineNumber) {
    return;
  }

  focusedCheckingLineNumber.value =
    checkingLineNumbers.value[checkingLineNumbers.value.length - 1] ?? null;

  if (focusedCheckingLineNumber.value) {
    void nextTick(() =>
      scrollBatchTextareaLineIntoView(focusedCheckingLineNumber.value || 1),
    );
  }
}

function resetCheckingLines() {
  checkingLineNumbers.value = [];
  focusedCheckingLineNumber.value = null;
}

function scrollBatchTextareaLineIntoView(lineNumber: number) {
  const textarea = batchTextareaRef.value;

  if (!textarea) {
    return;
  }

  const styles = window.getComputedStyle(textarea);
  const fontSize = Number.parseFloat(styles.fontSize) || 14;
  const lineHeight =
    Number.parseFloat(styles.lineHeight) || Math.round(fontSize * 1.5);
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const lineTop = paddingTop + (lineNumber - 1) * lineHeight;
  const nextScrollTop = Math.max(
    0,
    lineTop - (textarea.clientHeight - lineHeight) / 2,
  );

  textarea.scrollTo({
    top: nextScrollTop,
    behavior: "smooth",
  });
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  const message = error instanceof Error ? error.message : String(error || "");
  return /abort|cancel/i.test(message);
}

function stopBatchCheck() {
  if (!isBatchChecking.value) {
    return;
  }

  batchAbortController.value?.abort();
  markPendingBatchRowsAsStopped();
  resetCheckingLines();
  batchErrorMessage.value = "Batch check stopped.";
  isBatchChecking.value = false;
}

async function runBatchCheck() {
  if (isBatchChecking.value) {
    return;
  }

  batchErrorMessage.value = "";

  let inputs: BatchCheckInput[] = [];

  try {
    inputs = parseBatchInput();
  } catch (error) {
    batchRows.value = [];
    result.value = null;
    activeBatchRowId.value = null;
    resetCheckingLines();
    batchErrorMessage.value = getErrorMessage(
      error,
      "Could not parse batch input.",
    );
    return;
  }

  const startedAt = Date.now();
  batchRows.value = inputs.map((input, index) => ({
    ...input,
    id: startedAt + index,
    platform: selectedPlatform.value,
    mode: proxyMode.value,
    status: "queued",
  }));
  activeBatchRowId.value = null;
  result.value = null;
  resetCheckingLines();
  isBatchChecking.value = true;

  const abortController = new AbortController();
  batchAbortController.value = abortController;

  let cursor = 0;
  const workerCount = Math.min(3, batchRows.value.length);

  async function runWorker() {
    while (cursor < batchRows.value.length && !abortController.signal.aborted) {
      const row = batchRows.value[cursor];
      cursor += 1;

      if (!row) {
        continue;
      }

      updateBatchRow(row.id, {
        status: "checking",
        errorMessage: "",
      });
      focusCheckingLine(row.lineNumber);

      try {
        const data = await fetchStoreCheck(
          row.target,
          row.proxy,
          abortController.signal,
        );
        updateBatchRow(row.id, {
          status: "done",
          result: data,
        });

        if (activeBatchRowId.value === row.id) {
          result.value = data;
        }
      } catch (error) {
        updateBatchRow(row.id, {
          status: "error",
          errorMessage:
            abortController.signal.aborted || isAbortError(error)
              ? "Batch check stopped."
              : getErrorMessage(error, "Could not check this row."),
        });
      } finally {
        blurCheckingLine(row.lineNumber);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  } finally {
    if (abortController.signal.aborted) {
      markPendingBatchRowsAsStopped();
    }

    if (batchAbortController.value === abortController) {
      batchAbortController.value = null;
    }

    isBatchChecking.value = false;
    resetCheckingLines();
  }
}

function selectBatchRow(row: BatchCheckRow) {
  activeBatchRowId.value = row.id;
  result.value = row.result ?? null;
}

function getStoreStatusLabel(status: StoreLifecycleStatus) {
  return status;
}

function getBatchRowStatus(row: BatchCheckRow) {
  if (row.status === "queued") {
    return "Queued";
  }

  if (row.status === "checking") {
    return "Checking";
  }

  if (row.status === "error") {
    return "Error";
  }

  if (row.result?.storeStatus) {
    return getStoreStatusLabel(row.result.storeStatus);
  }

  return row.result?.verdict.status === "alive" ? "alive" : "dead";
}

function getBatchRowSeverity(row: BatchCheckRow) {
  if (row.status === "error") {
    return "danger";
  }

  if (row.status === "queued" || row.status === "checking") {
    return "neutral";
  }

  if (row.result?.storeStatus === "alive") {
    return "ok";
  }

  if (row.result?.storeStatus === "dead") {
    return "danger";
  }

  return row.result?.verdict.severity || "neutral";
}

function getPlatformLabel(platform: CheckPlatform) {
  return platform === "shopify" ? "Shopify" : platform;
}

function getBatchRowHref(row: BatchCheckRow) {
  if (row.result?.normalizedUrl) {
    return row.result.normalizedUrl;
  }

  const target = row.target.trim().replace(/^@/, "");

  if (!target) {
    return "";
  }

  if (/^https?:\/\//i.test(target)) {
    return target;
  }

  const host = target.includes(".") ? target : `${target}.myshopify.com`;

  return `https://${host}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <main class="status-shell">
    <PageHeader
      title="Check Status"
      sub="Batch check public storefront signals"
    >
      <IconsCheck />
      <template #actions>
        <span class="platform-pill">Shopify</span>
      </template>
    </PageHeader>

    <div class="checker-workspace" :class="{ 'has-result': result }">
      <div class="checker-left-column">
        <section class="checker-panel">
          <div class="batch-form">
            <div class="batch-topbar">
              <div class="batch-topbar-left">
                <div class="mode-toggle" role="group" aria-label="Proxy mode">
                  <button
                    v-for="option in proxyModeOptions"
                    :key="option.value"
                    type="button"
                    class="mode-option"
                    :class="{ 'is-active': proxyMode === option.value }"
                    :aria-pressed="proxyMode === option.value"
                    @click="setProxyMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div class="batch-topbar-right">
                <StatusBatchRunButton
                  :busy="isBatchChecking"
                  label="Check Shopify"
                  busy-label="Checking Shopify"
                  @run="runBatchCheck"
                  @stop="stopBatchCheck"
                />
              </div>
            </div>

            <div class="batch-textarea-wrap">
              <div class="batch-highlight-layer" aria-hidden="true">
                <div
                  class="batch-highlight-scroll"
                  :style="batchHighlightLayerStyle"
                >
                  <span
                    v-for="(line, index) in batchInputLines"
                    :key="`${index}-${line}`"
                    class="batch-highlight-line"
                    :class="{ 'is-checking': isBatchLineChecking(index + 1) }"
                  >
                    {{ line || " " }}
                  </span>
                </div>
              </div>
              <textarea
                id="batch-targets"
                ref="batchTextareaRef"
                v-model="batchInput"
                class="batch-textarea"
                :placeholder="batchPlaceholder"
                rows="10"
                spellcheck="false"
                wrap="off"
                @scroll="syncBatchTextareaScroll"
              />
            </div>

            <StatusCommonProxyField
              v-if="proxyMode === 'common-proxy'"
              v-model="commonProxy"
            />

            <StatusBatchProgressBar
              v-if="isBatchProgressVisible"
              :completed="batchCompletedCount"
              :errors="batchStats.errors"
              :label="batchProgressLabel"
              :percent="batchProgressPercent"
              :running="batchStats.checking"
              :total="batchStats.total"
            />
          </div>

          <p v-if="batchErrorMessage" class="error-message">
            {{ batchErrorMessage }}
          </p>
        </section>

        <section
          v-if="batchRows.length"
          class="batch-results"
          aria-live="polite"
        >
          <div class="batch-results-heading">
            <h2>{{ batchStats.total }} rows</h2>
            <div class="batch-result-stats">
              <span class="is-ok">Alive {{ batchStats.alive }}</span>
              <span class="is-danger">Dead {{ batchStats.dead }}</span>
              <span>Error {{ batchStats.errors }}</span>
            </div>
          </div>

          <div class="batch-table-wrap">
            <table
              class="batch-table"
              :class="{ 'is-no-proxy': !isBatchProxyColumnVisible }"
            >
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Platform</th>
                  <th scope="col">URL</th>
                  <th v-if="isBatchProxyColumnVisible" scope="col">Proxy</th>
                  <th scope="col">Status</th>
                  <th scope="col">Message</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in batchRows"
                  :key="row.id"
                  class="batch-row"
                  :class="[
                    `is-${getBatchRowSeverity(row)}`,
                    { 'is-active': activeBatchRowId === row.id },
                  ]"
                  tabindex="0"
                  :aria-selected="activeBatchRowId === row.id"
                  @click="selectBatchRow(row)"
                  @keydown.enter.prevent="selectBatchRow(row)"
                >
                  <td class="batch-line">#{{ row.lineNumber }}</td>
                  <td>
                    <span class="batch-platform">{{
                      getPlatformLabel(row.platform)
                    }}</span>
                  </td>
                  <td>
                    <a
                      class="batch-target-link"
                      :href="getBatchRowHref(row)"
                      target="_blank"
                      rel="noopener noreferrer"
                      @click.stop
                    >
                      {{ row.target }}
                    </a>
                  </td>
                  <td v-if="isBatchProxyColumnVisible" class="batch-proxy">
                    {{ getBatchRowProxyDisplay(row) }}
                  </td>
                  <td>
                    <span class="batch-status">{{
                      getBatchRowStatus(row)
                    }}</span>
                  </td>
                  <td class="batch-message">
                    {{
                      row.result?.verdict.summary ||
                      row.errorMessage ||
                      "Waiting"
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section v-if="result" class="result-layout" aria-live="polite">
        <aside class="summary-panel" :class="`is-${result.verdict.severity}`">
          <p class="eyebrow">Store status</p>
          <h2>
            {{ result.verdict.status }}
          </h2>
          <p>{{ result.verdict.summary }}</p>
          <dl>
            <div>
              <dt>Platform</dt>
              <dd>{{ getPlatformLabel(result.platform) }}</dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{{ result.host }}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{{ result.normalizedUrl }}</dd>
            </div>
            <div v-if="result.proxyIp">
              <dt>Proxy IP</dt>
              <dd>{{ result.proxyIp }}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{{ formatDate(result.checkedAt) }}</dd>
            </div>
          </dl>
        </aside>

        <div class="checks">
          <StatusCheckCard
            v-for="check in result.checks"
            :key="check.key"
            :check="check"
            :expanded="isCheckExpanded(check.key)"
            :severity-label="severityLabel"
            @toggle="toggleCheckCard(check.key)"
          />
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.status-shell {
  /* width: min(60%, calc(100% - 32px)); */
  width: fit-content;
  margin: 0 auto;
  padding: 28px 0 40px;
}

.checker-workspace {
  display: grid;
  gap: 12px;
  align-items: start;
}

.checker-workspace.has-result {
  grid-template-columns: minmax(0, 0.95fr) minmax(320px, 0.5fr);
  height: calc(100vh - 88px);
  align-items: stretch;
  overflow: hidden;
}

.checker-left-column {
  display: grid;
  min-width: 0;
  gap: 12px;
  min-width: 65rem;
}

.checker-workspace.has-result .checker-left-column {
  grid-template-rows: auto minmax(0, 1fr);
  max-height: calc(100vh - 88px);
  overflow: hidden;
  position: sticky;
  top: 16px;
  min-width: 30rem;
}

.checker-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.platform-pill {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(39, 92, 145, 0.22);
  border-radius: 8px;
  padding: 0 14px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 0.78rem;
  font-weight: 900;
}

.mode-toggle {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px;
  background: var(--surface-soft);
}

.mode-option {
  min-height: 30px;
  border: 0;
  border-radius: 6px;
  padding: 0 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
}

.mode-option:hover,
.mode-option:focus-visible {
  color: var(--green);
}

.mode-option:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.34);
  outline-offset: 2px;
}

.mode-option.is-active {
  background: var(--surface);
  color: var(--green);
  box-shadow: 0 1px 3px rgba(20, 34, 27, 0.12);
}

.batch-form {
  grid-column: 1 / -1;
  display: grid;
  gap: 10px;
}

.batch-topbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.batch-topbar-left,
.batch-topbar-right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.batch-topbar-left {
  flex: 1 1 360px;
}

.batch-topbar-right {
  justify-content: flex-end;
}

.batch-textarea-wrap {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
}

.batch-highlight-layer,
.batch-textarea {
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-wrap: normal;
  white-space: pre;
}

.batch-highlight-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  padding: 10px 12px;
  color: transparent;
  pointer-events: none;
}

.batch-highlight-scroll {
  min-width: 100%;
  transition: transform 0.08s linear;
}

.batch-highlight-line {
  display: block;
  min-width: 100%;
  height: 1.5em;
  border-radius: 4px;
}

.batch-highlight-line.is-checking {
  background: linear-gradient(
    90deg,
    rgba(31, 122, 77, 0.18),
    rgba(39, 92, 145, 0.12)
  );
  box-shadow: inset 3px 0 0 var(--green);
  padding-left: 4px;
}

.batch-textarea {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 126px;
  border: 0;
  background: transparent;
  color: var(--text);
  outline: none;
  overflow: auto;
  resize: vertical;
  padding: 10px 12px;
}

.batch-textarea-wrap:focus-within,
.batch-textarea:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 4px rgba(31, 122, 77, 0.12);
}

.error-message {
  grid-column: 1 / -1;
  margin: 0;
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--red-soft);
  color: var(--red);
  font-weight: 700;
}

.batch-results {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.checker-workspace.has-result .batch-results {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.batch-results-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.batch-results-heading h2 {
  margin: 3px 0 0;
  font-size: 1rem;
  letter-spacing: 0;
}

.batch-result-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.batch-result-stats span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.batch-result-stats .is-ok {
  border-color: rgba(31, 122, 77, 0.24);
  background: var(--green-soft);
  color: var(--green);
}

.batch-result-stats .is-warning {
  border-color: rgba(155, 100, 22, 0.26);
  background: var(--amber-soft);
  color: var(--amber);
}

.batch-result-stats .is-danger {
  border-color: rgba(180, 49, 43, 0.24);
  background: var(--red-soft);
  color: var(--red);
}

.batch-table-wrap {
  max-height: min(460px, calc(100vh - 360px));
  overflow: auto;
}

.checker-workspace.has-result .batch-table-wrap {
  flex: 1 1 auto;
  max-height: none;
}

.batch-table {
  width: 100%;
  /* min-width: 920px; */
  border-collapse: separate;
  border-spacing: 0;
}

.batch-table.is-no-proxy {
  /* min-width: 820px; */
  max-width: 100%;
}

.batch-table th,
.batch-table td {
  border-bottom: 1px solid var(--line);
  padding: 12px 16px;
  text-align: left;
  vertical-align: middle;
  font-weight: 500;
}

.batch-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(238, 244, 240, 0.86);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 900;
}

.batch-table td {
  color: var(--text);
  font-size: 0.8rem;
}

.batch-table tbody tr {
  cursor: pointer;
  outline: none;
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.batch-table tbody tr td:nth-child(3) {
  white-space: nowrap;
}

.batch-table tbody tr:last-child td {
  border-bottom: 0;
}

.batch-table tbody tr:hover,
.batch-table tbody tr:focus,
.batch-table tbody tr.is-active {
  background: var(--surface-soft);
}

.batch-table tbody tr.is-active {
  box-shadow: inset 4px 0 0 var(--green);
}

.batch-line,
.batch-platform,
.batch-proxy {
  color: var(--muted);
}

.batch-platform {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--surface-soft);
}

.batch-target-link,
.batch-message {
  min-width: 0;
  overflow-wrap: anywhere;
}

.batch-target-link {
  color: var(--blue);
  font-weight: 700;
  text-decoration: none;
}

.batch-target-link:hover,
.batch-target-link:focus {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.batch-message {
  color: var(--muted);
}

.batch-status {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--blue-soft);
  color: var(--blue);
}

.batch-row.is-ok .batch-status {
  background: var(--green-soft);
  color: var(--green);
}

.batch-row.is-warning .batch-status {
  background: var(--amber-soft);
  color: var(--amber);
}

.batch-row.is-danger .batch-status {
  background: var(--red-soft);
  color: var(--red);
}

.result-layout {
  display: grid;
  min-width: 0;
  gap: 12px;
  align-content: start;
  align-items: start;
}

.checker-workspace.has-result .result-layout {
  align-self: start;
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-gutter: stable;
}

.summary-panel {
  align-self: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 18px;
}

.summary-panel p {
  color: var(--green);
  line-height: 1.65;
}

.eyebrow {
  margin: 0;
  color: var(--green);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.summary-panel h2 {
  margin: 8px 0;
  font-size: 1.25rem;
  line-height: 1.1;
  letter-spacing: 0;
}

.summary-panel dl {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

.summary-panel div {
  display: grid;
  grid-template-columns: minmax(88px, max-content) minmax(0, 1fr);
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.summary-panel dt {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 800;
}

.summary-panel dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.checks {
  display: grid;
  gap: 10px;
  align-self: start;
}

@media (max-width: 860px) {
  .status-shell {
    width: min(100% - 24px, 680px);
    padding: 24px 0;
  }

  .checker-workspace.has-result,
  .checker-panel,
  .result-layout {
    grid-template-columns: 1fr;
  }

  .checker-workspace.has-result {
    height: auto;
    overflow: visible;
  }

  .checker-workspace.has-result .checker-left-column {
    max-height: none;
    overflow: visible;
    position: static;
  }

  .checker-workspace.has-result .result-layout {
    max-height: none;
    overflow-y: visible;
    padding-right: 0;
  }

  .batch-topbar,
  .batch-results-heading {
    display: grid;
  }

  .batch-topbar-right {
    justify-content: flex-start;
  }

  .batch-results-heading {
    align-items: start;
  }

  .batch-result-stats {
    justify-content: flex-start;
  }

  .batch-table {
    min-width: 820px;
  }

  .checker-panel {
    padding: 22px;
  }
}

@media (max-width: 560px) {
  .mode-toggle {
    width: 100%;
  }

  .mode-option {
    flex: 1 1 100%;
    width: 100%;
  }

  .batch-table {
    min-width: 760px;
  }

  .batch-table th,
  .batch-table td {
    padding: 10px 12px;
  }
}
</style>
