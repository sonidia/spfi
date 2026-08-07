<script lang="ts" setup>
import { useLoading } from "./composables/useLoading";
import { useTokenRotation } from "./composables/useTokenRotation";

const { loading } = useLoading();
useTokenRotation();
</script>

<template>
  <main class="app-root">
    <CredentialUnlock />
    <ClientOnly>
      <LoadingOverlay :visible="loading" />
    </ClientOnly>
    <BaseToast />
    <Nav />
    <NuxtLayout>
      <NuxtPage :keepalive="{ max: 12 }" />
    </NuxtLayout>
  </main>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  color-scheme: light;
  --footer-height: 36px;
  --bg: #f5f7f4;
  --surface: #ffffff;
  --surface-low: #fbfcfb;
  --surface-raised: #ffffff;
  --surface-soft: #eef4f0;
  --surface-overlay: rgba(255, 255, 255, 0.88);
  --text: #14221b;
  --text-sub: #65756c;
  --text-link: #275c91;
  --muted: #65756c;
  --line: #d9e4dd;
  --border: #d9e4dd;
  --green: #1f7a4d;
  --green-soft: #dff4e8;
  --green-bg: #dff4e8;
  --blue: #275c91;
  --blue-soft: #e2eef9;
  --amber: #9b6416;
  --amber-soft: #fff0d5;
  --red: #b4312b;
  --red-soft: #ffe2df;
  --shadow: 0 20px 60px rgba(20, 34, 27, 0.1);
  --shadow-soft: 0 10px 28px rgba(20, 34, 27, 0.08);
  --body-gradient-start: rgba(231, 239, 234, 0.9);
  --body-gradient-end: rgba(245, 247, 244, 0);
  --badge-paid: #dff4e8;
  --badge-paid-text: #1f7a4d;
  --badge-paid-border: #1f7a4d40;
  --badge-fulfilled: #e0f0ff;
  --badge-fulfilled-text: #275c91;
  --badge-fulfilled-border: #275c9140;
  --badge-archived: #f1f2f4;
  --badge-archived-text: #6d7175;
  --badge-cancelled: #ffe2df;
  --badge-cancelled-text: #b4312b;
  --badge-pending: #fff0d5;
  --badge-pending-text: #9b6416;
  --radius: 8px;
  --radius-sm: 8px;
  --font:
    "DM Sans", Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  --text-primary: var(--text);
  --text-secondary: var(--muted);
  --text-muted: #8b9991;
}

html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1512;
  --surface: #151c18;
  --surface-low: #111813;
  --surface-raised: #19221d;
  --surface-soft: #213228;
  --surface-overlay: rgba(21, 28, 24, 0.9);
  --text: #edf4ef;
  --text-sub: #a7b8ad;
  --text-link: #8fb9e8;
  --muted: #9aa9a0;
  --line: #2b3a32;
  --border: #2f3f36;
  --green: #7ed6a3;
  --green-soft: #183928;
  --green-bg: #183928;
  --blue: #8fb9e8;
  --blue-soft: #182d42;
  --amber: #f3c56b;
  --amber-soft: #3a2b13;
  --red: #ff8b82;
  --red-soft: #3e1f1f;
  --shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
  --shadow-soft: 0 14px 34px rgba(0, 0, 0, 0.28);
  --body-gradient-start: rgba(39, 58, 47, 0.82);
  --body-gradient-end: rgba(15, 21, 18, 0);
  --badge-paid: #183928;
  --badge-paid-text: #7ed6a3;
  --badge-paid-border: #7ed6a340;
  --badge-fulfilled: #182d42;
  --badge-fulfilled-text: #8fb9e8;
  --badge-fulfilled-border: #8fb9e840;
  --badge-archived: #263029;
  --badge-archived-text: #a7b8ad;
  --badge-cancelled: #3e1f1f;
  --badge-cancelled-text: #ff8b82;
  --badge-pending: #3a2b13;
  --badge-pending-text: #f3c56b;
  --text-primary: var(--text);
  --text-secondary: var(--muted);
  --text-muted: #7f9186;
}

html,
body {
  font-family:
    "DM Sans",
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
  background:
    linear-gradient(
      180deg,
      var(--body-gradient-start),
      var(--body-gradient-end) 320px
    ),
    var(--bg);
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

a {
  text-decoration: none;
}

select,
input,
textarea {
  outline: none;
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(31, 122, 77, 0.45) rgba(217, 228, 221, 0.45);
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--line) 55%, transparent);
  border-radius: 999px;
}

*::-webkit-scrollbar-thumb {
  border: 2px solid var(--bg);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(31, 122, 77, 0.72),
    rgba(39, 92, 145, 0.66)
  );
}

*::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    rgba(31, 122, 77, 0.88),
    rgba(39, 92, 145, 0.82)
  );
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

.app-root {
  font-family: var(--font);
  color: var(--text-primary);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout,
.page {
  max-width: 1028px;
  min-width: 100%;
  margin: 0 auto;
}

html[data-theme="dark"] .topbar.is-scrolled {
  background: var(--surface-overlay);
  border-bottom-color: var(--border);
  box-shadow: var(--shadow-soft);
}

html[data-theme="dark"] .card,
html[data-theme="dark"] .step-card,
html[data-theme="dark"] .workflow-card,
html[data-theme="dark"] .motivation-card,
html[data-theme="dark"] .faq-item,
html[data-theme="dark"] .ops-preview,
html[data-theme="dark"] .preview-panel,
html[data-theme="dark"] .modal-card,
html[data-theme="dark"] .popover-content,
html[data-theme="dark"] .empty-state,
html[data-theme="dark"] .metric-card,
html[data-theme="dark"] .assurance-item,
html[data-theme="dark"] .summary-card,
html[data-theme="dark"] .payment-shell,
html[data-theme="dark"] .sidebar,
html[data-theme="dark"] .sheet-card,
html[data-theme="dark"] .table-container,
html[data-theme="dark"] .products-panel,
html[data-theme="dark"] .pagination-controls {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}

html[data-theme="dark"] .preview-toolbar,
html[data-theme="dark"] .example-block,
html[data-theme="dark"] .config-grid,
html[data-theme="dark"] .config-row:nth-child(odd),
html[data-theme="dark"] .scope-block,
html[data-theme="dark"] .scope-label,
html[data-theme="dark"] .credential-item,
html[data-theme="dark"] .tag,
html[data-theme="dark"] .badge,
html[data-theme="dark"] .status-badge,
html[data-theme="dark"] .status-pill,
html[data-theme="dark"] .code-inline,
html[data-theme="dark"] .runbook-item:hover,
html[data-theme="dark"] .action-hint,
html[data-theme="dark"] .btn-outline,
html[data-theme="dark"] .btn-ghost:hover,
html[data-theme="dark"] .btn-sort:hover,
html[data-theme="dark"] .btn-sort.is-active,
html[data-theme="dark"] .popover-item:hover,
html[data-theme="dark"] .search-inp,
html[data-theme="dark"] .inp,
html[data-theme="dark"] .sidebar-search,
html[data-theme="dark"] .copy-button,
html[data-theme="dark"] .expand-btn {
  background: var(--surface-soft);
  border-color: var(--border);
  color: var(--text);
}

html[data-theme="dark"] :is(
  .table,
  .data-table,
  .sheet-table,
  .product-table,
  .products-table,
  .orders-table,
  .transactions-table,
  .payout-table,
  .customer-table,
  .table-wrapper,
  .table-card,
  .list-row,
  .product-row,
  .order-row,
  .transaction-row,
  .customer-row
) {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}

html[data-theme="dark"] :is(
  th,
  .table-head,
  .table-header,
  .sheet-header,
  .product-header,
  .order-header,
  .transaction-header
) {
  background: var(--surface-soft);
  border-color: var(--border);
  color: var(--text);
}

html[data-theme="dark"] :is(td, .table-cell, .cell, .field-value) {
  border-color: var(--border);
  color: var(--text);
}

html[data-theme="dark"] .setup-guide,
html[data-theme="dark"] .step-header h2,
html[data-theme="dark"] .step-body > p,
html[data-theme="dark"] .steps-list li,
html[data-theme="dark"] .example-result,
html[data-theme="dark"] .scope-code,
html[data-theme="dark"] .credential-name,
html[data-theme="dark"] .store-id,
html[data-theme="dark"] .signal-row strong,
html[data-theme="dark"] .preview-panel strong {
  color: var(--text);
}

html[data-theme="dark"] .example-label,
html[data-theme="dark"] .config-key,
html[data-theme="dark"] .credential-hint,
html[data-theme="dark"] .arrow,
html[data-theme="dark"] .expiry,
html[data-theme="dark"] .panel-kicker,
html[data-theme="dark"] .preview-panel span,
html[data-theme="dark"] .signal-row span {
  color: var(--muted);
}

html[data-theme="dark"] .landing-cta,
html[data-theme="dark"] .note-card {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--green-soft) 82%, transparent),
      color-mix(in srgb, var(--blue-soft) 78%, transparent)
    ),
    var(--surface-soft);
  border-color: var(--border);
}

html[data-theme="dark"] .scope-box::after {
  background: linear-gradient(
    to bottom,
    rgba(33, 50, 40, 0) 0%,
    rgba(33, 50, 40, 0.82) 50%,
    rgba(33, 50, 40, 1) 100%
  );
}

.popover-content .popover-menu {
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.popover-content .popover-actions {
  min-width: 160px;
}

.popover-content .popover-item {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  transition:
    background 0.1s,
    color 0.1s;
}

.popover-content .popover-item:hover {
  background: var(--surface-soft);
}

.popover-content .popover-item.active {
  background: var(--blue-soft);
  color: var(--blue);
  font-weight: 600;
}

.popover-content .popover-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}

.popover-content .text-danger {
  color: var(--red, var(--badge-cancelled-text)) !important;
}

.popover-content .fulfillment-popover {
  min-width: 220px;
  padding: 12px;
}

.popover-content .popover-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
  font-size: 12px;
}

.popover-content .popover-line.border-top {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.popover-content .popover-lbl {
  color: var(--text-sub);
  font-weight: 500;
}

.popover-content .popover-val {
  color: var(--text);
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
