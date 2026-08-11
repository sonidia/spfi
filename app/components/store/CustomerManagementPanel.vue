<script setup lang="ts">
import { Copy, Link, Mail, MapPin, Pencil, Plus, Star, Trash2, X } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useCustomers } from "~/composables/useCustomers";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyCustomer,
  ShopifyCustomerAddress,
  ShopifyNumericId,
} from "~~/types/shopify";
import type {
  ShopifyCustomerAddressInput,
  ShopifyCustomerInput,
} from "~~/types/shopify-customer";

const {
  selectedCustomer,
  addresses,
  isMutating,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchAddresses,
  saveAddress,
  deleteAddress,
  setDefaultAddress,
  createActivationUrl,
  sendInvite,
} = useCustomers();
const toast = useToastStore();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();

const dialog = ref<"customer" | "address" | null>(null);
const editingCustomerId = ref<ShopifyNumericId | null>(null);
const editingAddressId = ref<ShopifyNumericId | null>(null);
const activationUrl = ref("");
const customerForm = ref<ShopifyCustomerInput>(emptyCustomerForm());
const addressForm = ref<ShopifyCustomerAddressInput>(emptyAddressForm());

const customerId = computed(() => selectedCustomer.value?.id || null);
const customerDialogTitle = computed(() =>
  editingCustomerId.value ? "Edit customer" : "Create customer",
);

watch(
  customerId,
  (id) => {
    activationUrl.value = "";
    if (id) void fetchAddresses(id);
  },
  { immediate: true },
);

function emptyCustomerForm(): ShopifyCustomerInput {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    tags: "",
    note: "",
  };
}

function emptyAddressForm(): ShopifyCustomerAddressInput {
  return {
    first_name: "",
    last_name: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    country: "",
    zip: "",
    phone: "",
  };
}

function openCreateCustomer() {
  editingCustomerId.value = null;
  customerForm.value = emptyCustomerForm();
  dialog.value = "customer";
}

function openEditCustomer() {
  const customer = selectedCustomer.value;
  if (!customer) return;
  editingCustomerId.value = customer.id || null;
  customerForm.value = {
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    tags: customer.tags || "",
    note: customer.note || "",
    tax_exempt: Boolean(customer.tax_exempt),
  };
  dialog.value = "customer";
}

function openAddress(address?: ShopifyCustomerAddress) {
  editingAddressId.value = address?.id || null;
  addressForm.value = address
    ? {
        first_name: address.first_name || "",
        last_name: address.last_name || "",
        company: address.company || "",
        address1: address.address1 || "",
        address2: address.address2 || "",
        city: address.city || "",
        province: address.province || "",
        country: address.country || "",
        zip: address.zip || "",
        phone: address.phone || "",
      }
    : emptyAddressForm();
  dialog.value = "address";
}

function closeDialog() {
  dialog.value = null;
  editingCustomerId.value = null;
  editingAddressId.value = null;
}

async function submitCustomer() {
  const input = normalizeCustomerInput(customerForm.value);
  if (!input.email && !input.phone) {
    toast.error("Email or phone is required.");
    return;
  }

  const result = editingCustomerId.value
    ? await updateCustomer(editingCustomerId.value, input)
    : await createCustomer(input);
  if (!result) return;

  toast.success(editingCustomerId.value ? "Customer updated." : "Customer created.");
  closeDialog();
}

async function removeCustomer() {
  const customer = selectedCustomer.value;
  if (
    !customer?.id ||
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("customer.deleteConfirm", { name: customerName(customer) }),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  if (await deleteCustomer(customer.id)) {
    toast.success("Customer deleted.");
  }
}

async function submitAddress() {
  if (!customerId.value || !String(addressForm.value.address1 || "").trim()) {
    toast.error("Address line 1 is required.");
    return;
  }
  const result = await saveAddress(
    customerId.value,
    normalizeAddressInput(addressForm.value),
    editingAddressId.value || undefined,
  );
  if (!result) return;

  toast.success(editingAddressId.value ? "Address updated." : "Address added.");
  closeDialog();
}

async function removeAddress(address: ShopifyCustomerAddress) {
  if (
    !customerId.value ||
    !address.id ||
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("customer.deleteAddressConfirm"),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  if (await deleteAddress(customerId.value, address.id)) {
    toast.success("Address deleted.");
  }
}

async function makeDefault(address: ShopifyCustomerAddress) {
  if (!customerId.value || !address.id) return;
  if (await setDefaultAddress(customerId.value, address.id)) {
    toast.success("Default address updated.");
  }
}

async function generateActivationUrl() {
  if (!customerId.value) return;
  const response = await createActivationUrl(customerId.value);
  if (!response) return;
  activationUrl.value = response.account_activation_url;
  toast.success("Activation URL created.");
}

async function inviteCustomer() {
  const customer = selectedCustomer.value;
  if (!customer?.id || !customer.email) {
    toast.error("The customer needs an email address before sending an invite.");
    return;
  }
  if (
    !(await requestConfirmation({
      title: t("confirm.actionTitle"),
      message: t("customer.sendInviteConfirm", { email: customer.email }),
      confirmLabel: t("customer.sendInvite"),
      danger: false,
    }))
  ) {
    return;
  }
  if (await sendInvite(customer.id, { to: customer.email })) {
    toast.success("Activation invite sent.");
  }
}

async function copyActivationUrl() {
  if (!activationUrl.value) return;
  try {
    await navigator.clipboard.writeText(activationUrl.value);
    toast.success("Activation URL copied.");
  } catch {
    toast.error("Could not copy the activation URL.");
  }
}

function normalizeCustomerInput(input: ShopifyCustomerInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ""),
  ) as ShopifyCustomerInput;
}

function normalizeAddressInput(input: ShopifyCustomerAddressInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ""),
  ) as ShopifyCustomerAddressInput;
}

function customerName(customer: ShopifyCustomer) {
  return (
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email ||
    `Customer #${customer.id}`
  );
}

function addressSummary(address: ShopifyCustomerAddress) {
  return [
    address.address1,
    address.address2,
    address.city,
    address.province_code || address.province,
    address.zip,
    address.country_code || address.country,
  ]
    .filter(Boolean)
    .join(", ");
}
</script>

<template>
  <section class="management-panel">
    <div class="management-actions">
      <div>
        <strong>Customer management</strong>
        <span v-if="selectedCustomer">
          Actions for {{ customerName(selectedCustomer) }}
        </span>
        <span v-else>Select a customer to manage their account and addresses.</span>
      </div>
      <div class="button-row">
        <BaseButton
          variant="primary"
          :disabled="isMutating"
          @click="openCreateCustomer"
        >
          <template #icon><Plus /></template>
          Add customer
        </BaseButton>
        <template v-if="selectedCustomer">
          <BaseButton :disabled="isMutating" @click="openEditCustomer">
            <template #icon><Pencil /></template>
            Edit
          </BaseButton>
          <BaseButton :loading="isMutating" @click="generateActivationUrl">
            <template #icon><Link /></template>
            Activation URL
          </BaseButton>
          <BaseButton :loading="isMutating" @click="inviteCustomer">
            <template #icon><Mail /></template>
            Send invite
          </BaseButton>
          <BaseButton
            variant="danger-ghost"
            :disabled="isMutating"
            @click="removeCustomer"
          >
            <template #icon><Trash2 /></template>
            Delete
          </BaseButton>
        </template>
      </div>
    </div>

    <div v-if="activationUrl" class="activation-row">
      <input :value="activationUrl" readonly aria-label="Activation URL" />
      <BaseButton @click="copyActivationUrl">
        <template #icon><Copy /></template>
        Copy
      </BaseButton>
    </div>

    <div v-if="selectedCustomer" class="address-section">
      <div class="section-head">
        <div>
          <strong>Addresses</strong>
          <span>{{ addresses.length }} saved</span>
        </div>
        <BaseButton :disabled="isMutating" @click="openAddress()">
          <template #icon><MapPin /></template>
          Add address
        </BaseButton>
      </div>
      <div v-if="addresses.length" class="address-grid">
        <article v-for="address in addresses" :key="address.id" class="address-card">
          <div>
            <strong>
              {{
                [address.first_name, address.last_name].filter(Boolean).join(" ") ||
                "Address"
              }}
              <span v-if="address.default" class="default-pill">Default</span>
            </strong>
            <span>{{ addressSummary(address) || "No address details" }}</span>
          </div>
          <div class="address-actions">
            <BaseButton
              v-if="!address.default"
              variant="ghost"
              icon-only
              title="Make default"
              :disabled="isMutating"
              @click="makeDefault(address)"
            >
              <template #icon><Star /></template>
            </BaseButton>
            <BaseButton
              variant="ghost"
              icon-only
              title="Edit address"
              :disabled="isMutating"
              @click="openAddress(address)"
            >
              <template #icon><Pencil /></template>
            </BaseButton>
            <BaseButton
              variant="danger-ghost"
              icon-only
              title="Delete address"
              :disabled="isMutating"
              @click="removeAddress(address)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </article>
      </div>
      <div v-else class="empty-addresses">No customer addresses.</div>
    </div>

    <div
      v-if="dialog"
      class="dialog-backdrop"
      role="presentation"
      @click.self="closeDialog"
    >
      <form
        class="dialog"
        role="dialog"
        aria-modal="true"
        @submit.prevent="dialog === 'customer' ? submitCustomer() : submitAddress()"
      >
        <header>
          <h3>
            {{
              dialog === "customer"
                ? customerDialogTitle
                : editingAddressId
                  ? "Edit address"
                  : "Add address"
            }}
          </h3>
          <button type="button" aria-label="Close" @click="closeDialog">
            <X />
          </button>
        </header>

        <div v-if="dialog === 'customer'" class="form-grid">
          <label
            ><span>First name</span><input v-model="customerForm.first_name"
          /></label>
          <label
            ><span>Last name</span><input v-model="customerForm.last_name"
          /></label>
          <label
            ><span>Email</span><input v-model="customerForm.email" type="email"
          /></label>
          <label
            ><span>Phone</span><input v-model="customerForm.phone" type="tel"
          /></label>
          <label class="wide"
            ><span>Tags</span><input v-model="customerForm.tags"
          /></label>
          <label class="wide"
            ><span>Note</span><textarea v-model="customerForm.note" rows="3" />
          </label>
          <label class="check wide">
            <input v-model="customerForm.tax_exempt" type="checkbox" />
            <span>Tax exempt</span>
          </label>
        </div>

        <div v-else class="form-grid">
          <label
            ><span>First name</span><input v-model="addressForm.first_name"
          /></label>
          <label><span>Last name</span><input v-model="addressForm.last_name" /></label>
          <label class="wide"
            ><span>Company</span><input v-model="addressForm.company"
          /></label>
          <label class="wide"
            ><span>Address line 1 *</span
            ><input v-model="addressForm.address1" required
          /></label>
          <label class="wide"
            ><span>Address line 2</span><input v-model="addressForm.address2"
          /></label>
          <label><span>City</span><input v-model="addressForm.city" /></label>
          <label
            ><span>Province/state</span><input v-model="addressForm.province"
          /></label>
          <label><span>Country</span><input v-model="addressForm.country" /></label>
          <label><span>Postal code</span><input v-model="addressForm.zip" /></label>
          <label class="wide"
            ><span>Phone</span><input v-model="addressForm.phone" type="tel"
          /></label>
        </div>

        <footer>
          <BaseButton type="button" @click="closeDialog">Cancel</BaseButton>
          <BaseButton
            variant="primary"
            :loading="isMutating"
            @click="dialog === 'customer' ? submitCustomer() : submitAddress()"
          >
            Save
          </BaseButton>
        </footer>
      </form>
    </div>
  </section>
</template>

<style scoped>
.management-panel {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.management-actions,
.section-head,
.activation-row,
.address-card,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.management-actions {
  padding: 14px 16px;
}
.management-actions > div:first-child,
.section-head > div {
  display: grid;
  gap: 2px;
}
.management-actions strong,
.section-head strong {
  color: var(--text);
  font-size: 13px;
}
.management-actions span,
.section-head span,
.address-card span {
  color: var(--text-sub);
  font-size: 11px;
}
.button-row,
.address-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.activation-row {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-soft);
}
.activation-row input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--surface-raised);
  color: var(--text);
}
.address-section {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}
.address-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.address-card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px;
}
.address-card > div:first-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.address-card > div:first-child > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.default-pill {
  margin-left: 5px;
  border-radius: 999px;
  padding: 2px 6px;
  background: var(--green-soft);
  color: var(--green) !important;
}
.empty-addresses {
  margin-top: 10px;
  border: 1px dashed var(--border);
  border-radius: 7px;
  padding: 18px;
  color: var(--text-sub);
  text-align: center;
}
.dialog-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}
.dialog {
  width: min(620px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.dialog h3 {
  color: var(--text);
  font-size: 15px;
}
.dialog header button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
}
.dialog header svg {
  width: 17px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}
.form-grid label {
  display: grid;
  gap: 5px;
}
.form-grid .wide {
  grid-column: 1 / -1;
}
.form-grid label > span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}
.form-grid input,
.form-grid textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}
.form-grid .check {
  display: flex;
  align-items: center;
}
.form-grid .check input {
  width: 16px;
}
footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  justify-content: flex-end;
}
@media (max-width: 720px) {
  .management-actions,
  .section-head {
    align-items: stretch;
    flex-direction: column;
  }
  .address-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid .wide {
    grid-column: auto;
  }
}
</style>
