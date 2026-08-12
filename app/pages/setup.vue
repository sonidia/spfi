<template>
  <AdminPageShell :title="t('setup.title')" :sub="t('setup.subtitle')" size="narrow">
    <template #icon>
      <IconsHero />
    </template>

    <div class="setup-guide">
      <div class="steps">
        <!-- STEP 1 -->
        <div class="step-card">
          <div class="step-header">
            <span class="step-badge">01</span>
            <h2>{{ t("setup.stepStoreIdTitle") }}</h2>
          </div>
          <div class="step-body">
            <p>
              {{ t("setup.stepStoreIdBody") }}
              <span class="tag">{{ t("setup.storeId") }}</span
              >.
            </p>
            <div class="example-block">
              <div class="example-label">{{ t("setup.example") }}</div>
              <div class="example-content">
                <code class="code-inline">3ute8a-h4.myshopify.com</code>
                <span class="arrow">→</span>
                <span class="example-result"
                  >{{ t("setup.storeId") }}:
                  <code class="code-inline highlight">3ute8a-h4</code></span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 2 -->
        <div class="step-card">
          <div class="step-header">
            <span class="step-badge">02</span>
            <h2>{{ t("setup.stepCreateAppTitle") }}</h2>
          </div>
          <div class="step-body">
            <ol class="steps-list">
              <li>{{ t("setup.createAppOpenApps") }} <span class="tag">Apps</span></li>
              <li>
                {{ t("setup.createAppDevelop") }}
                <span class="tag">Develop apps</span>
              </li>
              <li>{{ t("setup.createAppDashboard") }}</li>
              <li>{{ t("setup.createAppCreate") }}</li>
              <li>
                {{ t("setup.createAppName") }}
                <code class="code-inline">fitblend.store</code>
              </li>
            </ol>
          </div>
        </div>

        <!-- STEP 3 -->
        <div class="step-card">
          <div class="step-header">
            <span class="step-badge">03</span>
            <h2>
              {{ t("setup.stepConfigureTitle") }}
              <span class="tab-label">{{ t("setup.tabVersions") }}</span>
            </h2>
          </div>
          <div class="step-body">
            <div class="config-grid">
              <div class="config-row">
                <span class="config-key">{{ t("setup.redirectUrl") }}</span>
                <code class="code-inline">https://admin.shopify.com</code>
              </div>
              <!-- <div class="config-row">
              <span class="config-key">App URL</span>
              <code class="code-inline">http://localhost/new-install</code>
            </div>
            <div class="config-row">
              <span class="config-key">Embed in admin</span>
              <span class="badge-off">Bỏ tick</span>
            </div> -->
              <div class="config-row">
                <span class="config-key">{{ t("setup.apiVersion") }}</span>
                <code class="code-inline highlight">2026-07</code>
              </div>
            </div>

            <div class="scope-block">
              <div>
                <div class="scope-label">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  {{ t("setup.scopes") }}
                </div>
                <button
                  class="copy-button"
                  :class="{ copied }"
                  @click="copyScopes"
                  :title="t('setup.copyScopes')"
                >
                  <IconsCopy v-if="!copied" class="copy-icon" />
                  <span v-else class="copy-success">
                    <IconsCheck />
                    {{ t("common.done") }}
                  </span>
                </button>
              </div>

              <div class="scope-wrapper">
                <div class="scope-box" :class="{ expanded: isExpanded }">
                  <pre class="scope-code">{{ scopes }}</pre>
                </div>

                <div v-if="!isExpanded" class="fade-overlay">
                  <button class="expand-btn" @click="isExpanded = true">
                    <IconsArrowRight class="expand-icon" />
                    {{ t("setup.expand") }}
                  </button>
                </div>
              </div>
            </div>

            <div class="action-hint">
              <div class="action-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12h14M12 5l7 7-7 7"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              {{ t("setup.releaseHint") }}
              <span class="tag">Release → Release</span>
            </div>
          </div>
        </div>

        <!-- STEP 4 -->
        <div class="step-card">
          <div class="step-header">
            <span class="step-badge">04</span>
            <h2>
              {{ t("setup.stepCredentialsTitle") }}
              <span class="tab-label">{{ t("setup.tabSettings") }}</span>
            </h2>
          </div>
          <div class="step-body">
            <div class="credential-list">
              <div class="credential-item">
                <div class="credential-icon">ID</div>
                <div>
                  <div class="credential-name">{{ t("setup.clientId") }}</div>
                  <div class="credential-hint">{{ t("setup.copyAndSave") }}</div>
                </div>
              </div>
              <div class="credential-item">
                <div class="credential-icon">SK</div>
                <div>
                  <div class="credential-name">{{ t("setup.clientSecret") }}</div>
                  <div class="credential-hint">{{ t("setup.copyAndSave") }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 5 -->
        <div class="step-card">
          <div class="step-header">
            <span class="step-badge">05</span>
            <h2>
              {{ t("setup.stepInstallTitle") }}
              <span class="tab-label">{{ t("setup.firstTab") }}</span>
            </h2>
          </div>
          <div class="step-body">
            <ol class="steps-list">
              <li>{{ t("setup.installApp") }}</li>
              <li>{{ t("setup.chooseStore") }}</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- NOTE -->
      <div class="note-card">
        <div class="note-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <polyline
              points="14,2 14,8 20,8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div>
          <div class="note-title">{{ t("setup.noteTitle") }}</div>
          <code class="code-inline note-format">store_id/client_id/client_secret</code>
        </div>
      </div>
    </div>
  </AdminPageShell>
</template>

<script setup>
import { ref } from "vue";

definePageMeta({ layout: false });

const isExpanded = ref(false);
const copied = ref(false);
const { t } = useLocalization();

const scopes =
  "read_all_orders,read_analytics,read_analytics_annotations,write_analytics_annotations,read_app_proxy,write_app_proxy,read_apps,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_audit_events,read_customer_events,read_cart_transforms,write_cart_transforms,read_all_cart_transforms,read_validations,write_validations,read_cash_tracking,write_cash_tracking,read_channels,write_channels,read_checkout_kit_enhanced_buyer_events,read_checkout_and_accounts_configurations,write_checkout_and_accounts_configurations,read_checkout_branding_settings,write_checkout_branding_settings,write_checkouts,read_checkouts,read_companies,write_companies,read_custom_fulfillment_services,write_custom_fulfillment_services,read_custom_pixels,write_custom_pixels,read_customers,write_customers,read_customer_data_erasure,write_customer_data_erasure,read_customer_payment_methods,read_customer_merge,write_customer_merge,read_delivery_customizations,write_delivery_customizations,read_price_rules,write_price_rules,read_discounts,write_discounts,read_discounts_allocator_functions,write_discounts_allocator_functions,read_discovery,write_discovery,write_draft_orders,read_draft_orders,read_files,write_files,read_fulfillment_constraint_rules,write_fulfillment_constraint_rules,read_fulfillments,write_fulfillments,read_gift_card_transactions,write_gift_card_transactions,read_gift_cards,write_gift_cards,write_inventory,read_inventory,write_inventory_shipments,read_inventory_shipments,write_inventory_shipments_received_items,read_inventory_shipments_received_items,write_inventory_transfers,read_inventory_transfers,read_legal_policies,write_legal_policies,read_delivery_option_generators,write_delivery_option_generators,read_locales,write_locales,write_locations,read_locations,read_marketing_integrated_campaigns,write_marketing_integrated_campaigns,write_marketing_events,read_marketing_events,read_markets,write_markets,read_markets_home,write_markets_home,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_metaobject_definitions,write_metaobject_definitions,read_metaobjects,write_metaobjects,read_online_store_navigation,write_online_store_navigation,read_online_store_pages,write_online_store_pages,write_order_edits,read_order_edits,read_orders,write_orders,write_packing_slip_templates,read_packing_slip_templates,write_payment_mandate,read_payment_mandate,read_payment_notifications,write_payment_notifications,read_payment_terms,write_payment_terms,read_payment_customizations,write_payment_customizations,read_privacy_settings,write_privacy_settings,read_product_feeds,write_product_feeds,read_product_listings,write_product_listings,read_products,write_products,read_publications,write_publications,read_purchase_options,write_purchase_options,write_reports,read_reports,read_resource_feedbacks,write_resource_feedbacks,read_returns,write_returns,read_script_tags,write_script_tags,read_shipping,write_shipping,read_shopify_payments_accounts,read_shopify_payments_payouts,read_shopify_payments_bank_accounts,read_shopify_payments_disputes,write_shopify_payments_disputes,read_content,write_content,read_store_credit_account_transactions,write_store_credit_account_transactions,read_store_credit_accounts,write_own_subscription_contracts,read_own_subscription_contracts,write_theme_code,read_themes,write_themes,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,read_translations,write_translations,read_pixels,write_pixels,customer_read_companies,customer_write_companies,customer_write_customers,customer_read_customers,customer_read_draft_orders,customer_read_markets,customer_read_metaobjects,customer_read_orders,customer_write_orders,customer_read_store_credit_account_transactions,customer_read_store_credit_accounts,customer_write_own_subscription_contracts,customer_read_own_subscription_contracts,unauthenticated_write_bulk_operations,unauthenticated_read_bulk_operations,unauthenticated_read_bundles,unauthenticated_write_checkouts,unauthenticated_read_checkouts,unauthenticated_write_customers,unauthenticated_read_customers,unauthenticated_read_customer_tags,unauthenticated_read_metaobjects,unauthenticated_read_product_pickup_locations,unauthenticated_read_product_inventory,unauthenticated_read_product_listings,unauthenticated_read_product_tags,unauthenticated_read_selling_plans,unauthenticated_read_shop_pay_installments_pricing,unauthenticated_read_content,shop_app:oauth";

const copyScopes = async () => {
  try {
    await navigator.clipboard.writeText(scopes);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
};
</script>

<style scoped>
.setup-guide {
  display: grid;
  gap: 12px;
  font-family: var(--font);
  color: var(--text);
  line-height: 1.6;
}

/* Step cards */
.steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 10px;
  transition: box-shadow 0.15s ease;
}

.step-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--border);
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--blue-soft);
  color: var(--blue);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.step-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.tab-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--blue);
  background: var(--blue-soft);
  padding: 2px 8px;
  border-radius: 20px;
}

.step-body {
  padding: 18px 22px 20px;
}

.step-body > p {
  margin: 0 0 14px;
  font-size: 14px;
  color: var(--text-sub);
}

/* Tags */
.tag {
  display: inline-block;
  background: var(--surface-soft);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 5px;
  border: 1px solid var(--border);
}

/* Code */
.code-inline {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface-soft);
  color: var(--red);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.code-inline.highlight {
  background: var(--amber-soft);
  color: var(--amber);
  border-color: var(--border);
}

/* Example block */
.example-block {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 4px;
}

.example-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.example-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 14px;
}

.arrow {
  color: var(--text-muted);
  font-size: 16px;
}

.example-result {
  color: var(--text-sub);
  font-size: 14px;
}

/* Steps list */
.steps-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: step-counter;
}

.steps-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text-sub);
  counter-increment: step-counter;
}

.steps-list li::before {
  content: counter(step-counter);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Config grid */
.config-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  font-size: 13.5px;
  gap: 16px;
}

.config-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.config-row:nth-child(odd) {
  background: var(--surface-soft);
}

.config-key {
  color: var(--text-sub);
  font-weight: 500;
  flex-shrink: 0;
}

.badge-off {
  font-size: 12px;
  font-weight: 500;
  color: var(--amber);
  background: var(--amber-soft);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 20px;
}

/* Scope block */
.scope-block {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}

.scope-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-sub);
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.scope-code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  line-height: 1.8;
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Action hint */
.action-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--text-sub);
  background: var(--blue-soft);
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid var(--blue);
}

.action-icon {
  display: flex;
  align-items: center;
  color: var(--blue);
  flex-shrink: 0;
}

/* Credentials */
.credential-list {
  display: flex;
  flex-direction: row;
  gap: 10px;
}

.credential-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 50%;
}

.credential-icon {
  width: 40px;
  height: 40px;
  background: var(--blue-soft);
  color: var(--blue);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.credential-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2px;
}

.credential-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* Note card */
.note-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--green-soft);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 12px;
}

.note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--green-soft);
  color: var(--green);
  border-radius: 8px;
  flex-shrink: 0;
}

.note-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--green);
  margin-bottom: 6px;
}

.note-format {
  background: var(--surface);
  border-color: var(--border);
  color: var(--green);
  font-size: 13px;
}

/* Scope expansion */
.scope-block,
.scope-wrapper {
  position: relative;
}

.scope-box {
  position: relative;
  max-height: 140px;
  overflow: hidden;
  transition: max-height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.scope-box.expanded {
  max-height: 2000px;
}

.scope-box::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    color-mix(in srgb, var(--surface-soft) 80%, transparent) 50%,
    var(--surface-soft) 100%
  );
  pointer-events: none;
  transition: opacity 0.4s ease;
}

.scope-box.expanded::after {
  opacity: 0;
}

.fade-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 20px;
  pointer-events: none;
}

.expand-btn {
  pointer-events: auto;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--blue);
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(91, 71, 224, 0.12);
  transition: all 0.25s ease;
}

.expand-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(91, 71, 224, 0.18);
  background: var(--blue-soft);
  border-color: var(--blue);
}

.expand-icon {
  width: 14px;
  height: 14px;
  transform: rotate(90deg);
  transition: transform 0.3s ease;
}

.expand-btn:hover .expand-icon {
  transform: rotate(90deg) translateX(2px);
}

.copy-button {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s ease;
  padding: 0;
}

.copy-button:hover {
  background: var(--green-soft);
  border-color: var(--green);
  transform: scale(1.05);
  box-shadow: 0 4px 10px rgba(16, 172, 0, 0.1);
}

.copy-button.copied {
  width: auto;
  padding: 0 10px;
  border-color: var(--green);
  background: var(--green-soft);
}

.copy-icon {
  width: 18px;
  height: 18px;
}

.copy-success {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--green);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.copy-success svg {
  width: 13px;
  height: 13px;
}
</style>
