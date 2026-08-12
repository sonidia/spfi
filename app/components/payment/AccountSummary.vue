<script setup lang="ts">
import { computed } from "vue";
import { useLocalization } from "~/composables/useLocalization";
import { usePaymentStore } from "~/stores/payment";

const paymentStore = usePaymentStore();
const account = computed(() => paymentStore.paymentsAccount);
const { t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();

const schedule = computed(() => {
  const value = account.value?.payoutSchedule;
  if (!value) return t("payment.unavailable");

  const interval = formatPaymentLabel(value.interval);
  if (value.weeklyAnchor) {
    return `${interval} · ${formatPaymentLabel(value.weeklyAnchor)}`;
  }
  if (value.monthlyAnchor) {
    return `${interval} · ${t("payment.dayOfMonth", { day: value.monthlyAnchor })}`;
  }
  return interval;
});

function bankAccountLabel(index: number) {
  const bank = account.value?.bankAccounts[index];
  if (!bank) return t("payment.bankAccount");
  return bank.bankName || t("payment.bankAccountNumber", { number: index + 1 });
}
</script>

<template>
  <section v-if="account" class="account-summary">
    <div class="account-facts">
      <article>
        <span>{{ t("payment.paymentsAccount") }}</span>
        <strong>{{
          account.activated ? t("payment.activated") : t("payment.notActivated")
        }}</strong>
        <small>{{ account.country }} · {{ account.defaultCurrency }}</small>
      </article>
      <article>
        <span>{{ t("payment.payoutSchedule") }}</span>
        <strong>{{ schedule }}</strong>
        <small>{{
          account.payoutStatementDescriptor || t("payment.noPayoutDescriptor")
        }}</small>
      </article>
      <article>
        <span>{{ t("payment.chargeDescriptor") }}</span>
        <strong>
          {{
            account.chargeStatementDescriptors?.default ||
            account.chargeStatementDescriptors?.prefix ||
            t("payment.notConfigured")
          }}
        </strong>
        <small v-if="account.accountOpenerName">
          {{ t("payment.openedBy", { name: account.accountOpenerName }) }}
        </small>
        <small v-else>{{ t("payment.accountOpenerUnavailable") }}</small>
      </article>
    </div>

    <div class="bank-accounts">
      <div class="section-heading">
        <strong>{{ t("payment.bankAccounts") }}</strong>
        <span>{{
          t("payment.configuredCount", { count: account.bankAccounts.length })
        }}</span>
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
            {{ formatPaymentLabel(bank.status) }}
          </small>
        </article>
      </div>
      <p v-else class="empty-bank">{{ t("payment.noBankAccount") }}</p>
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
