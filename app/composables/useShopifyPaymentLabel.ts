import type { MessageKey } from "~/locales/messages";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

const PAYMENT_VALUE_KEYS: Record<string, MessageKey> = {
  charge: "payment.value.charge",
  refund: "payment.value.refund",
  adjustment: "payment.value.adjustment",
  payout: "payment.value.payout",
  dispute: "payment.value.dispute",
  credit: "payment.value.credit",
  debit: "payment.value.debit",
  pending: "payment.value.pending",
  paid: "payment.value.paid",
  failed: "payment.value.failed",
  canceled: "payment.value.canceled",
  cancelled: "payment.value.canceled",
  scheduled: "payment.value.scheduled",
  in_transit: "payment.value.inTransit",
  action_required: "payment.value.actionRequired",
  needs_response: "payment.value.needsResponse",
  under_review: "payment.value.underReview",
  accepted: "payment.value.accepted",
  prevented: "payment.value.prevented",
  won: "payment.value.won",
  lost: "payment.value.lost",
  daily: "payment.value.daily",
  weekly: "payment.value.weekly",
  monthly: "payment.value.monthly",
  monday: "payment.value.monday",
  tuesday: "payment.value.tuesday",
  wednesday: "payment.value.wednesday",
  thursday: "payment.value.thursday",
  friday: "payment.value.friday",
  saturday: "payment.value.saturday",
  sunday: "payment.value.sunday",
  active: "payment.value.active",
  inactive: "payment.value.inactive",
  verified: "payment.value.verified",
  unverified: "payment.value.unverified",
};

export function useShopifyPaymentLabel() {
  const { t } = useLocalization();

  function formatPaymentLabel(value: string | null | undefined) {
    const key = PAYMENT_VALUE_KEYS[normalizePaymentValue(value)];
    return key ? t(key) : formatShopifyPaymentLabel(value);
  }

  return { formatPaymentLabel };
}

function normalizePaymentValue(value: string | null | undefined) {
  const leaf = String(value || "")
    .split("::")
    .filter(Boolean)
    .pop();

  return String(leaf || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}
