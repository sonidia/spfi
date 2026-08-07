<script setup lang="ts">
import { computed } from "vue";
import { usePaymentStore } from "~/stores/payment";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

const paymentStore = usePaymentStore();
const account = computed(() => paymentStore.paymentsAccount);

const schedule = computed(() => {
  const value = account.value?.payoutSchedule;
  if (!value) return "Unavailable";

  const interval = formatShopifyPaymentLabel(value.interval);
  if (value.weeklyAnchor) {
    return `${interval} · ${formatShopifyPaymentLabel(value.weeklyAnchor)}`;
  }
  if (value.monthlyAnchor) {
    return `${interval} · day ${value.monthlyAnchor}`;
  }
  return interval;
});

function bankAccountLabel(index: number) {
  const bank = account.value?.bankAccounts[index];
  if (!bank) return "Bank account";
  return bank.bankName || `Bank account ${index + 1}`;
}
</script>

<template>
  <section v-if="account" class="account-summary">
    <div class="account-facts">
      <article>
        <span>Payments account</span>
        <strong>{{ account.activated ? "Activated" : "Not activated" }}</strong>
        <small>{{ account.country }} · {{ account.defaultCurrency }}</small>
      </article>
      <article>
        <span>Payout schedule</span>
        <strong>{{ schedule }}</strong>
        <small>{{ account.payoutStatementDescriptor || "No payout descriptor" }}</small>
      </article>
      <article>
        <span>Charge descriptor</span>
        <strong>
          {{
            account.chargeStatementDescriptors?.default ||
            account.chargeStatementDescriptors?.prefix ||
            "Not configured"
          }}
        </strong>
        <small v-if="account.accountOpenerName">
          Opened by {{ account.accountOpenerName }}
        </small>
        <small v-else>Account opener unavailable</small>
      </article>
    </div>

    <div class="bank-accounts">
      <div class="section-heading">
        <strong>Bank accounts</strong>
        <span>{{ account.bankAccounts.length }} configured</span>
      </div>
      <div v-if="account.bankAccounts.length" class="bank-list">
        <article
          v-for="(bank, index) in account.bankAccounts"
          :key="bank.id"
          class="bank-item"
        >
          <div>
            <strong>{{ bankAccountLabel(index) }}</strong>
            <span>•••• {{ bank.accountNumberLastDigits }}</span>
          </div>
          <small>
            {{ bank.currency }} · {{ bank.country }} ·
            {{ formatShopifyPaymentLabel(bank.status) }}
          </small>
        </article>
      </div>
      <p v-else class="empty-bank">No bank account was returned by Shopify.</p>
    </div>
  </section>
</template>

<style scoped>
.account-summary {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.account-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.account-facts article,
.bank-item {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  background: var(--surface-soft);
}

.account-facts span,
.account-facts small,
.bank-item span,
.bank-item small,
.section-heading span,
.empty-bank {
  color: var(--text-sub);
  font-size: 11px;
}

.account-facts strong,
.account-facts small {
  display: block;
  margin-top: 4px;
}

.section-heading,
.bank-item,
.bank-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bank-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.empty-bank {
  margin: 8px 0 0;
}

@media (max-width: 800px) {
  .account-facts,
  .bank-list {
    grid-template-columns: 1fr;
  }
}
</style>
