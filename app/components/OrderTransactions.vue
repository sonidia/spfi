<template>
  <div class="timeline-wrap">
    <div v-for="group in groupedEvents" :key="group.date">
      <div class="date-label">{{ group.date }}</div>

      <div v-for="(event, idx) in group.items" :key="idx" class="event-row">
        <div class="dot-col">
          <div :class="['dot', event.dotType]" />
        </div>

        <div class="event-content">
          <div class="event-row-inner">
            <div class="event-text">
              <span>{{ event.text }}</span>
              <span v-if="event.payoutBadge" class="payout-tag">
                {{ event.payoutBadge }}
              </span>
              <span v-if="event.payoutSuffix">{{ event.payoutSuffix }}</span>
            </div>
            <div class="event-time">{{ event.time }}</div>
          </div>

          <div v-if="event.emailBtn" style="margin-top: 6px">
            <button class="action-btn" @click="$emit('view-email', event)">
              View email
            </button>
          </div>

          <div v-if="event.details && event.details.length">
            <div class="detail-box">
              <div
                v-for="[label, value] in event.details"
                :key="label"
                class="detail-row"
              >
                <span class="detail-label">{{ label }}</span>
                <span class="detail-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

defineEmits(["view-email"]);

// ── server fetch ─────────────────────────────────────────────────────────────
import {  useFetch } from "#app";

const sid = useLocalStorage("active_store_id", "").state.value || "";
const credentialVault = useCredentialVaultStore();
const token = credentialVault.getStoreData(sid).accessToken;

const { data, pending, error } = await useFetch(`/api/order/${props.order.id}/transactions`, {
  query: { storeId: sid, token },
});

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

// ── timeline logic ───────────────────────────────────────────────────────────

const groupedEvents = computed(() => {
  const events = [];

  // 1. Placement & Meta Events (Placement, Email, Confirmation)
  if (props.order.created_at) {
    const createdAt = props.order.created_at;
    const customerName = [props.order.customer?.first_name, props.order.customer?.last_name].join(' ').trim() || props.order.customer?.default_address?.name || 'Customer';
    const customerEmail = props.order.customer?.email || "";
    const checkoutId = props.order.checkout_id || props.order.checkout_token || "";

    // Placed
    events.push({
      timestamp: new Date(createdAt).getTime(),
      text: `${customerName} placed this order on Online Store (checkout #${checkoutId}).`,
      dotType: "",
    });

    // Confirmation Number
    events.push({
      timestamp: new Date(createdAt).getTime() + 1000, // offset slightly for order
      text: `Confirmation #${props.order.name || props.order.order_number} was generated for this order.`,
      dotType: "",
    });

    // Email Sent
    events.push({
      timestamp: new Date(createdAt).getTime() + 2000,
      text: `Order confirmation email was sent to ${customerName} (${customerEmail}).`,
      dotType: "",
      emailBtn: true,
    });
  }

  // 2. Fulfillments
  if (props.order.fulfillments && props.order.fulfillments.length) {
    props.order.fulfillments.forEach((f) => {
      const itemsCount = f.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      events.push({
        timestamp: new Date(f.created_at || props.order.created_at).getTime() + 10000,
        text: `You fulfilled ${itemsCount} item${itemsCount !== 1 ? 's' : ''} via ${f.service || 'Manual Fulfillment'}.`,
        dotType: "",
        details: [
          ["Service", f.service],
          ["Items", itemsCount],
          ["Status", "Fulfilled"],
        ]
      });
    });
  }

  // 3. Transactions
  if (data.value && data.value.transactions) {
    data.value.transactions.forEach((tx) => {
      const amountStr = `$${tx.amount ?? "0.00"} ${tx.currency ?? "CAD"}`;
      const brand = tx.payment_details?.credit_card_company ?? tx.receipt?.payment_method ?? "Card";
      const last4 = tx.payment_details?.credit_card_number?.slice(-4) ?? "****";
      const walletType = tx.payment_details?.credit_card_wallet?.replace("_", " ") ?? "";
      const via = walletType ? ` via ${walletType}` : "";

      let text = "";
      if (tx.kind === 'sale' || tx.kind === 'capture') {
        text = `A ${amountStr} payment was processed using a ${brand} ending in ${last4}${via}.`;
      } else if (tx.kind === 'authorization') {
        text = `A ${amountStr} payment was authorized using a ${brand} ending in ${last4}${via}.`;
      } else if (tx.kind === 'refund') {
        text = `A ${amountStr} refund was processed.`;
      } else {
        text = `A ${amountStr} transaction (${tx.kind}) was processed.`;
      }

      const cardDetails = tx.receipt?.latest_charge?.payment_method_details?.card;
      const details = [
        ["Gateway", tx.gateway ?? ""],
        ["Amount", amountStr],
        ["Status", tx.status ?? ""],
        ["Cardholder", tx.payment_details?.credit_card_name],
        ["Card", `${brand} •••• ${last4}`],
        ["Type", cardDetails?.description],
        ["Issuer", cardDetails?.issuer],
        ["Country", cardDetails?.country],
        ["AVS check", tx.payment_details?.avs_result_code],
        ["CVV check", tx.payment_details?.cvv_result_code],
        ["Authorization", tx.receipt?.latest_charge?.id ?? tx.authorization ?? ""],
      ].filter(row => row[1]);

      events.push({
        timestamp: new Date(tx.created_at).getTime(),
        text,
        dotType: tx.status === 'success' ? 'success' : 'info',
        details,
      });

      // 4. Payout Logic (derived from transaction)
      if (tx.status === 'success' && (tx.kind === 'sale' || tx.kind === 'capture')) {
        // Mock payout date (tx date + 2 days)
        const txDateObj = new Date(tx.created_at);
        const payoutDateObj = new Date(txDateObj.getTime() + 86400000 * 2);
        const payoutBadge = payoutDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        
        // "Will be added" event (same time as transaction)
        events.push({
          timestamp: txDateObj.getTime() + 1, // slightly after transaction
          text: `${amountStr} will be added to your`,
          payoutBadge: payoutBadge,
          payoutSuffix: " payout.",
          dotType: "info",
        });

        // "Was added" event (on payout day)
        // Only if payout date is in the past compared to "now"
        if (payoutDateObj.getTime() < Date.now()) {
          events.push({
            timestamp: payoutDateObj.getTime(),
            text: `${amountStr} was added to your`,
            payoutBadge: payoutBadge,
            payoutSuffix: " payout.",
            dotType: "info",
          });
        }
      }
    });
  }

  // 5. Archived
  if (props.order.closed_at) {
    events.push({
      timestamp: new Date(props.order.closed_at).getTime(),
      text: "This order was archived.",
      dotType: "",
    });
  }

  // Sort Descending
  events.sort((a, b) => b.timestamp - a.timestamp);

  // Group by Date
  const groups = {};
  events.forEach((ev) => {
    const d = new Date(ev.timestamp);
    const dateStr = formatDate(d.toISOString());
    if (!groups[dateStr]) groups[dateStr] = [];
    
    groups[dateStr].push({
      ...ev,
      time: formatTime(d.toISOString()),
    });
  });

  return Object.entries(groups).map(([date, items]) => ({ date, items }));
});
</script>

<style scoped>
.timeline-wrap {
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1a1a1a;
  padding: 0.5rem 0;
}

/* ── date group label ────────────────────────────────── */
.date-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  letter-spacing: 0.04em;
  margin: 1.5rem 0 0.5rem 28px;
}

/* ── event row ──────────────────────────────────────── */
.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 5px 0;
}

.dot-col {
  display: flex;
  align-items: flex-start;
  padding-top: 5px;
  width: 18px;
  flex-shrink: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
  flex-shrink: 0;
}
.dot.success {
  background: #1d9e75;
}
.dot.info {
  background: #378add;
}

/* ── content area ───────────────────────────────────── */
.event-content {
  flex: 1;
  min-width: 0;
}

.event-row-inner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.event-text {
  flex: 1;
  color: #1a1a1a;
  line-height: 1.55;
}

.event-time {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  padding-top: 2px;
}

/* ── payout badge ───────────────────────────────────── */
.payout-tag {
  display: inline-block;
  background: #f3f4f6;
  border: 0.5px solid #d1d5db;
  border-radius: 6px;
  padding: 1px 7px;
  font-size: 12px;
  color: #2563eb;
  margin: 0 3px;
  vertical-align: middle;
}

/* ── buttons ────────────────────────────────────────── */
.action-btn {
  border: 0.5px solid #d1d5db;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 13px;
  color: #1a1a1a;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.action-btn:hover {
  background: #f3f4f6;
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
}

.chevron {
  display: inline-block;
  font-size: 16px;
  color: #6b7280;
  line-height: 1;
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}
.chevron.open {
  transform: rotate(270deg);
}

/* ── detail box ─────────────────────────────────────── */
.detail-box {
  background: #f9fafb;
  border: 0.5px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 6px;
  font-size: 13px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 0.5px solid #f0f0f0;
}
.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #6b7280;
}
.detail-value {
  color: #1a1a1a;
  font-weight: 500;
}

/* ── dark mode ──────────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .timeline-wrap {
    color: #f3f4f6;
  }
  .date-label {
    color: #9ca3af;
  }
  .event-text {
    color: #f3f4f6;
  }
  .event-time {
    color: #9ca3af;
  }
  .payout-tag {
    background: #1f2937;
    border-color: #374151;
    color: #60a5fa;
  }
  .action-btn {
    color: #f3f4f6;
    border-color: #374151;
  }
  .action-btn:hover {
    background: #1f2937;
  }
  .detail-box {
    background: #1f2937;
    border-color: #374151;
  }
  .detail-row {
    border-bottom-color: #374151;
  }
  .detail-label {
    color: #9ca3af;
  }
  .detail-value {
    color: #f3f4f6;
  }
}
</style>
