<script lang="ts" setup>
import { useSheetService } from "~/composables/useSheetService";
import { getSheetUrls } from "~~/utils/sheets";

const { BUFF1_SHEET_URL, BUFF2_SHEET_URL, FBS_SHEET_URL, QUAN_LY_SHEET_URL } =
  getSheetUrls();
import { useLoading } from "../composables/useLoading";
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";
import { useProductStore } from "../stores/product";
import { useToastStore } from "../stores/toast";

const formStore = useFormStore();
const paymentStore = usePaymentStore(); // Moved up and ensured it's available
const orderStore = useOrderStore();
const productStore = useProductStore();
const toastStore = useToastStore();
const route = useRoute();
const router = useRouter();

const { loading: globalLoading } = useLoading();

onMounted(() => {
  formStore.loadKnownStores();

  // Try to restore from URL first, then cookie
  const queryShop = route.query.shop as string;
  const cookieShop = useLocalStorage("active_store_id", "").state.value;
  const initialShop = queryShop || cookieShop;

  if (queryShop) {
    formStore.storeId = queryShop;
    useLocalStorage("active_store_id", "").state.value = queryShop;
    fetchCurrent();
  } else {
    // If no query shop, we don't auto-select from cookie anymore
    formStore.storeId = "";
  }

  // Automatically load sheet names after 3 seconds, same as bulking page
  setTimeout(() => {
    loadPayouts();
  }, 3000);
});

const isFetching = computed(() => {
  const path = route.path;
  if (path === "/order" || path.startsWith("/order/"))
    return orderStore.isLoading;
  if (path.startsWith("/payment")) return paymentStore.isLoading;
  if (path === "/product") return productStore.isLoading;
  return false;
});

const noStores = computed(() => formStore.knownStores.length === 0);

// Auto-fetch when switching between Order/Payment tabs
watch(
  () => route.path,
  (newPath) => {
    if (newPath.startsWith("/order") || newPath.startsWith("/payment")) {
      fetchCurrent();
    }
  },
);

watch(
  isFetching,
  (val) => {
    if (val) globalLoading.value = true;
    else {
      globalLoading.value = false;
    }
  },
  { immediate: false },
);

// Sync shop from URL query changes (e.g. forward/backward or manual entry)
watch(
  () => route.query.shop,
  (newShop) => {
    if (newShop) {
      if (newShop !== formStore.storeId) {
        formStore.storeId = newShop as string;
        useLocalStorage("active_store_id", "").state.value = newShop as string;
        orderStore.$reset();
        paymentStore.$reset();
        productStore.$reset();
        fetchCurrent();
      }
    } else {
      formStore.storeId = "";
    }
  },
);

// ── Shop selector ────────────────────────────────────────────────────────────
function onSelectStore(id: string) {
  formStore.storeId = id;
  useLocalStorage("active_store_id", "").state.value = id;

  // Sync URL query param
  router.replace({ query: { ...route.query, shop: id } });

  // Clear existing data so the new store's data loads
  orderStore.$reset();
  paymentStore.$reset();
  productStore.$reset();
  fetchCurrent();
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  if (!sid) return null;
  const storeCookie = useLocalStorage<any>(sid, {}).state;
  const data = storeCookie.value;
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

// ── Fetch for the current page ───────────────────────────────────────────────
function fetchCurrent(force = false) {
  const sid = formStore.storeId;
  if (!sid) return;
  const token = resolveToken(sid);

  if (!token) {
    const msg = "Token expired or missing. Please go to Token page.";
    if (route.path === "/order") orderStore.error = msg;
    if (route.path.startsWith("/payment")) paymentStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path.startsWith("/order")) orderStore.error = null;
  if (route.path.startsWith("/payment")) paymentStore.error = null;

  if (route.path === "/order") {
    if (force || !orderStore.hasFetchedAll) orderStore.fetchAll(sid, token);
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/order/")) {
    const idMatch = route.path.match(/\/order\/(\d+)/);
    if (idMatch && idMatch[1]) {
      orderStore.fetchById(sid, token, idMatch[1], force);
    }
  } else if (route.path === "/payment") {
    if (force || (!paymentStore.payouts.length && !paymentStore.balance)) {
      paymentStore.fetchAll(sid, token);
    }
  } else if (route.path === "/payment/transactions") {
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/payment/payout/")) {
    const idMatch = route.path.match(/\/payment\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      paymentStore.fetchPayoutDetail(sid, token, Number(idMatch[1]), force);
    }
  } else if (route.path === "/product") {
    if (force || !productStore.hasFetchedAll) productStore.fetchAll(sid, token);
  }
}

// ── Get domain label for store select ────────────────────────────────────────
function getStoreDomain(id: string): string {
  if (!id) return "";
  const cookie = useLocalStorage<any>(id, {}).state;
  return cookie.value?.domain || "";
}

// ── Get sheet name for store ─────────────────────────────────────────────────
function getStoreSheet(id: string): string {
  if (!id) return "";
  const cookie = useLocalStorage<any>(id, {}).state;
  const cached: any = paymentStore.bulkingPayouts[id] || {};
  return cookie.value?.sheet || cached.sheet || "";
}

// ── Search functionality ─────────────────────────────────────────────────────
const searchQuery = ref("");
const filteredStores = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return formStore.knownStores;
  return formStore.knownStores.filter((id) => {
    const domain = getStoreDomain(id).toLowerCase();
    return id.toLowerCase().includes(query) || domain.includes(query);
  });
});

// ── Bulk Sheet & Payout Actions ──────────────────────────────────────────────
const {
  readSheetValues,
  updateSheetValues: _updateSheetValues,
  batchUpdateSheetValues,
  normalizeSpreadsheetId,
} = useSheetService();

const isLoadingPayouts = ref(false);
const isUpdating = ref(false);
const isSyncingDate = ref(false);
const isSyncingTracking = ref(false);

const syncMode = ref<"all" | "from_today">("from_today");
const syncCount = ref<number | "unlimit">(1);
const isSyncPopoverOpen = ref(false);

// ── Add Store Modal State ───────────────────────────────────────────────────
const isAddModalOpen = ref(false);
const addMode = ref<"single" | "bulking">("single");
const newStoreId = ref("");
const newDomain = ref("");
const newSock = ref("");
const newClientId = ref("");
const newClientSecret = ref("");

function clearInputs() {
  newDomain.value = "";
  newSock.value = "";
  newStoreId.value = "";
  newClientId.value = "";
  newClientSecret.value = "";
  genError.value = "";
  genSuccess.value = "";
  resetSteps();
}
const isFindingShop = ref(false);
const genError = ref("");
const genSuccess = ref("");

const findShopSteps = ref([
  { id: "MASTER", label: "Searching master sheet", status: "pending" },
  { id: "MACHINE_FETCH", label: "Fetching credentials", status: "pending" },
  { id: "TOKEN_GEN", label: "Generating Shopify Token", status: "pending" },
  { id: "DONE", label: "Finalizing store", status: "pending" },
]);

function resetSteps() {
  findShopSteps.value.forEach((s) => (s.status = "pending"));
}
function setStep(id: string, status: "pending" | "active" | "done" | "error") {
  const step = findShopSteps.value.find((s) => s.id === id);
  if (step) step.status = status;
}

function toUserFriendlyMessage(error: any) {
  const rawMessage = String(
    error?.data?.statusMessage || error?.data?.message || error?.message || "",
  );
  const msg = rawMessage.toLowerCase();

  if (
    msg.includes("socks5 authentication failed") ||
    (msg.includes("proxy") && msg.includes("authentication")) ||
    msg.includes("socket closed")
  ) {
    return "The SOCKS proxy is currently not working or the account details are incorrect. Please switch to a different proxy and try again.";
  }

  if (
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("ehostunreach") ||
    msg.includes("enotfound")
  ) {
    return "Không kết nối được tới proxy hoặc Shopify. Vui lòng kiểm tra mạng/proxy rồi thử lại.";
  }

  if (msg.includes("no proxy") || msg.includes("missing proxy")) {
    return "Thiếu thông tin sock (proxy). Vui lòng nhập sock trước khi thêm shop.";
  }

  return rawMessage || "Thao tác chưa thành công. Vui lòng thử lại.";
}

const { readProxySheetRows, buildRangeFromSheetName } = useSheetService();

const { getProxySheetPreset, getMachineSheets } =
  await import("~~/utils/sheets");
const machineSheets = getMachineSheets();

async function addShop() {
  const domains = newDomain.value
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean);
  if (!domains.length) return;

  genError.value = "";
  genSuccess.value = "";
  resetSteps();
  isFindingShop.value = true;

  const manSock = newSock.value.trim();
  const manSId = newStoreId.value.trim();
  const manCId = newClientId.value.trim();
  const manCSec = newClientSecret.value.trim();

  let successCount = 0;
  let errors: string[] = [];

  try {
    // 0. Master cache and Machine cache setup
    const quanLyUrl = FBS_SHEET_URL;
    let masterRows: any[] | null = null;
    const machineCache: Record<string, any[]> = {};

    for (const domain of domains) {
      resetSteps();
      setStep("MASTER", "active");

      let sId = domains.length === 1 ? manSId : "";
      let cId = domains.length === 1 ? manCId : "";
      let cSec = domains.length === 1 ? manCSec : "";
      let sock = domains.length === 1 ? manSock : "";

      try {
        if (!sId || !cId || !cSec) {
          const domainSearch = domain.toLowerCase();

          // 1. Discovery Phase
          if (!masterRows) {
            const presetQuanLy = getProxySheetPreset(quanLyUrl, "FBS");
            masterRows = await readProxySheetRows({
              spreadsheetId: normalizeSpreadsheetId(quanLyUrl),
              range: buildRangeFromSheetName(presetQuanLy?.tab || "FBS"),
              dataRowStart: presetQuanLy?.startRow || 3,
              mapping: presetQuanLy?.columns,
            });
          }

          const foundShop = masterRows.find(
            (r: any) => r.domain?.trim().toLowerCase() === domainSearch,
          );

          if (!foundShop) {
            throw new Error(`Không tìm thấy shop nào với domain: ${domain}`);
          }
          setStep("MASTER", "done");

          setStep("MACHINE_FETCH", "active");
          const machineNameRaw = foundShop.proxyUrl;
          const targetMachineUrl = machineNameRaw
            ? Object.entries(machineSheets).find(
                ([key]) =>
                  machineNameRaw.trim().toUpperCase() === key.toUpperCase(),
              )?.[1]
            : null;

          if (!targetMachineUrl) {
            throw new Error(`Không xác định được máy cho shop này.`);
          }

          let machineRows = machineCache[targetMachineUrl];
          if (!machineRows) {
            machineRows = await readProxySheetRows({
              spreadsheetId: normalizeSpreadsheetId(targetMachineUrl),
              range: buildRangeFromSheetName(""),
              dataRowStart: 2,
            });
            machineCache[targetMachineUrl] = machineRows;
          }

          const machineMatch = machineRows.find(
            (r: any) => r.domain?.trim().toLowerCase() === domainSearch,
          );

          if (!machineMatch) {
            throw new Error(`Không tìm thấy thông tin trên sheet máy.`);
          }

          if (machineMatch.proxyUrl && !sock)
            sock = machineMatch.proxyUrl.trim();
          if (machineMatch.storeId && !sId) sId = machineMatch.storeId;
          if (machineMatch.clientId && !cId) cId = machineMatch.clientId;
          if (machineMatch.clientSecret && !cSec)
            cSec = machineMatch.clientSecret;

          setStep("MACHINE_FETCH", "done");
        } else {
          setStep("MASTER", "done");
          setStep("MACHINE_FETCH", "done");
        }

        // 1.5 – Check if this store is already configured
        if (sId && formStore.knownStores.includes(sId)) {
          throw new Error(`Đã có sẵn store này (${sId}).`);
        }

        // 2. Token Generation Phase
        if (!sId || !cId || !cSec) {
          throw new Error("Missing Store ID, Client ID, or Secret.");
        }

        setStep("TOKEN_GEN", "active");
        const res: any = await $fetch("/api/generate-token", {
          method: "POST",
          body: {
            storeId: sId,
            clientId: cId,
            clientSecret: cSec,
            sock: sock,
          },
        });

        if (!res?.access_token) {
          throw new Error("Failed to retrieve access token");
        }
        setStep("TOKEN_GEN", "done");

        // 3. Storage Phase
        setStep("DONE", "active");
        const now = Date.now();
        const expiresTime = now + 24 * 60 * 60 * 1000;
        const cookie = useLocalStorage<any>(
          sId,
          {},
          { ttl: 60 * 60 * 24 * 365 * 10 * 1000 },
        ).state;
        cookie.value = {
          clientId: cId,
          clientSecret: cSec,
          accessToken: res.access_token,
          expiresTime,
          domain: domain,
          sock: sock,
        };

        formStore.addKnownStore(sId);
        if (domains.length === 1) {
          formStore.storeId = sId;
        }

        successCount++;
        setStep("DONE", "done");
      } catch (err: any) {
        setStep("TOKEN_GEN", "error");
        errors.push(`${domain}: ${toUserFriendlyMessage(err)}`);
      }
    }

    if (errors.length) {
      genError.value = errors.join("\n");
    }
    if (successCount > 0) {
      genSuccess.value = `Successfully added ${successCount} store(s).`;
      setTimeout(() => {
        isAddModalOpen.value = false;
        newStoreId.value = "";
        newClientId.value = "";
        newClientSecret.value = "";
        newDomain.value = "";
        newSock.value = "";
        genSuccess.value = "";
        resetSteps();
      }, 1500);
    }
  } finally {
    isFindingShop.value = false;
    if (domains.length > 1) {
      resetSteps();
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text");
  if (!text) return;
  const parts = text.split(/[\/|]/).map((s) => s.trim());
  if (parts.length >= 3) {
    event.preventDefault();
    newStoreId.value = parts[0] || "";
    newClientId.value = parts[1] || "";
    newClientSecret.value = parts[2] || "";
  }
}

const storeList = computed(() => {
  return formStore.knownStores.map((id) => {
    const cookie = useLocalStorage<any>(id, {}).state;
    const data = cookie.value;
    const cached: any = paymentStore.bulkingPayouts[id] || {};
    return {
      id,
      domain: data?.domain || "",
      accessToken: data?.accessToken || "",
      proxy: data?.sock || "",
      sheet: data?.sheet || cached.sheet || "",
    };
  });
});

async function loadPayouts() {
  const missingSheetStores = storeList.value.filter(
    (s) => !s.sheet && s.domain,
  );
  if (missingSheetStores.length === 0) return;

  isLoadingPayouts.value = true;
  try {
    const [b1Results, b2Results] = await Promise.allSettled([
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
        range: "'order 1'!A:Z",
      }),
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
        range: "'Sheet1'!A:Z",
      }),
    ]);

    const buff1Rows = b1Results.status === "fulfilled" ? b1Results.value : [];
    const buff2Rows = b2Results.status === "fulfilled" ? b2Results.value : [];

    for (const store of missingSheetStores) {
      const domainLower = store.domain.toLowerCase();

      let sheets = [];
      const inBuff1 = buff1Rows.some(
        (r) => r[3]?.trim().toLowerCase() === domainLower,
      );
      if (inBuff1) {
        sheets.push("$ buff1");
      }

      const inBuff2 = buff2Rows.some(
        (r) => r[3]?.trim().toLowerCase() === domainLower,
      );
      if (inBuff2) {
        sheets.push("$ buff2");
      }

      let sheetName = sheets.join(", ");

      if (sheetName) {
        const cookie = useLocalStorage<any>(
          store.id,
          {},
          { ttl: 60 * 60 * 24 * 365 * 10 * 1000 },
        ).state;

        // Update local storage only if it's different or the store didn't have a sheet name before
        if (cookie.value.sheet !== sheetName) {
          cookie.value = { ...cookie.value, sheet: sheetName };

          paymentStore.setBulkingPayout(store.id, {
            date: "",
            status: "",
            sheet: sheetName,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error loading payouts from spreadsheet:", err);
  } finally {
    isLoadingPayouts.value = false;
  }
}

async function updatePayouts(targetId?: string | Event) {
  const target = typeof targetId === "string" ? targetId : undefined;
  isUpdating.value = true;

  const storesToSync = target
    ? storeList.value.filter((s) => s.id === target)
    : storeList.value;
  const needsBuff1 = storesToSync.some((s) => s.sheet?.includes("$ buff1"));
  const needsBuff2 = storesToSync.some((s) => s.sheet?.includes("$ buff2"));

  let buff1Rows: any[] = [];
  let buff2Rows: any[] = [];
  let quanLyRows: any[] = [];
  let fbsRows: any[] = [];
  let appendedRowCount = 0;
  let appendedMessages: string[] = [];

  try {
    const sheetPromises = [
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
        range: "'quản lý'!A:Z",
      }),
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(FBS_SHEET_URL),
        range: "'FBS'!A:Z",
      }),
    ];

    if (needsBuff1) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
          range: "'order 1'!A:Z",
        }),
      );
    }

    if (needsBuff2) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
          range: "'Sheet1'!A:Z",
        }),
      );
    }

    const results = await Promise.allSettled(sheetPromises);

    let idx = 0;
    if (results[idx]?.status === "fulfilled") {
      quanLyRows = (results[idx] as PromiseFulfilledResult<any>).value;
    }
    idx++;

    if (results[idx]?.status === "fulfilled") {
      fbsRows = (results[idx] as PromiseFulfilledResult<any>).value;
    }
    idx++;

    if (needsBuff1) {
      if (results[idx]?.status === "fulfilled") {
        buff1Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }

    if (needsBuff2) {
      if (results[idx]?.status === "fulfilled") {
        buff2Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }
  } catch (e) {
    console.error("Failed to load some sheets for syncing", e);
  }

  let lastNonEmptyRow = quanLyRows.length;
  for (let i = quanLyRows.length - 1; i >= 0; i--) {
    const row = quanLyRows[i];
    if (row && (row[0]?.trim() || row[1]?.trim() || row[2]?.trim())) {
      lastNonEmptyRow = i + 1;
      break;
    }
  }

  const quanLyUpdates: any[] = [];

  for (const store of storesToSync) {
    if (!store.accessToken) {
      paymentStore.setBulkingPayout(store.id, {
        date: "No token",
        status: "No token",
        sheet: store.sheet,
      });
      continue;
    }
    paymentStore.setBulkingPayout(store.id, {
      date: "Fetching...",
      status: "Fetching...",
      sheet: store.sheet,
    });
    try {
      const [payoutRes, txRes, orderRes]: any = await Promise.all([
        $fetch("/api/payment/payout/all", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
        $fetch("/api/payment/payout/transactions", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
        $fetch("/api/order/all", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
      ]);

      if (payoutRes.payouts && payoutRes.payouts.length > 0) {
        let filteredPayouts: any[] = [];
        const todayStr = new Date().toISOString().split("T")[0];

        const existingPayouts: any[] = [];
        const newPayouts: any[] = [];

        payoutRes.payouts.forEach((p: any) => {
          const [p_year, p_month, p_day] = p.date.split("-");
          const formattedDate = `${p_day}/${p_month}`;

          let payoutStatus = p.status.toLowerCase();
          if (payoutStatus === "paid") payoutStatus = "Deposited";
          else
            payoutStatus =
              payoutStatus.charAt(0).toUpperCase() + payoutStatus.slice(1);

          const quanLyIndex = quanLyRows.findIndex(
            (r) =>
              r[2]?.trim().toLowerCase() === store.domain.toLowerCase() &&
              r[0]?.trim() === formattedDate,
          );

          if (quanLyIndex !== -1) {
            existingPayouts.push(p);
          } else {
            newPayouts.push(p);
          }
        });

        let processedNewPayouts = [...newPayouts];
        if (syncMode.value === "from_today") {
          processedNewPayouts = processedNewPayouts
            .filter((p: any) => p.date >= todayStr)
            .sort(
              (a: any, b: any) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            );

          if (syncCount.value !== "unlimit") {
            processedNewPayouts = processedNewPayouts.slice(
              0,
              Number(syncCount.value),
            );
          }
        }

        filteredPayouts = [...existingPayouts, ...processedNewPayouts];

        if (filteredPayouts.length === 0) {
          paymentStore.setBulkingPayout(store.id, {
            date: "No matching payouts",
            status: "Filtered",
            sheet: store.sheet,
          });
          continue;
        }

        // Map cached orders to their customer names and display names (APB1#...)
        const orderMap = new Map();
        const orderNameMap = new Map();
        if (orderRes && orderRes.orders) {
          orderRes.orders.forEach((o: any) => {
            const customerName = o.customer
              ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
              : "";
            orderMap.set(String(o.id), customerName);
            orderNameMap.set(String(o.id), o.name || "");
          });
        }

        // Map transactions to their IDs, order names, and cached customers
        const transactions = (txRes.transactions || [])
          .filter((tx: any) => tx.payout_id)
          .map((tx: any) => ({
            payoutId: String(tx.payout_id),
            sourceOrderId: tx.source_order_id
              ? String(tx.source_order_id)
              : null,
            orderName: tx.source_order_id
              ? orderNameMap.get(String(tx.source_order_id))
              : "",
            customerName: tx.source_order_id
              ? orderMap.get(String(tx.source_order_id))
              : "",
          }));

        const ascendingPayouts = [...filteredPayouts].sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        for (const payout of ascendingPayouts) {
          const payoutDate = payout.date;
          let payoutStatus = payout.status.toLowerCase();

          if (payoutStatus === "paid") {
            payoutStatus = "Deposited";
          } else {
            payoutStatus =
              payoutStatus.charAt(0).toUpperCase() + payoutStatus.slice(1);
          }

          const [p_year, p_month, p_day] = payoutDate.split("-");
          const formattedDate = `${p_day}/${p_month}`;

          const quanLyIndex = quanLyRows.findIndex(
            (r) =>
              r[2]?.trim().toLowerCase() === store.domain.toLowerCase() &&
              r[0]?.trim() === formattedDate,
          );

          // Find which sheet contains the customers for this payout
          let payoutTx = transactions.filter(
            (tx: any) => tx.payoutId === String(payout.id),
          );

          // If no transactions found in batch, fetch specifically for this payout
          if (payoutTx.length === 0) {
            try {
              const res: any = await $fetch(
                `/api/payment/payout/${payout.id}`,
                {
                  params: { storeId: store.id, token: store.accessToken },
                },
              );
              if (res.transactions) {
                payoutTx = res.transactions.map((tx: any) => ({
                  payoutId: String(tx.payout_id),
                  sourceOrderId: tx.source_order_id
                    ? String(tx.source_order_id)
                    : null,
                  orderName: tx.source_order_id
                    ? orderNameMap.get(String(tx.source_order_id))
                    : "",
                  customerName: tx.source_order_id
                    ? orderMap.get(String(tx.source_order_id))
                    : "",
                }));
              }
            } catch (e) {
              console.error(
                `Failed to fetch specific transactions for payout ${payout.id}`,
                e,
              );
            }
          }

          // Resolve missing order/customer data if any
          const payoutTxCustomers: string[] = [];
          const payoutTxOrderNames: string[] = [];
          for (const tx of payoutTx) {
            let custName = tx.customerName || "";
            let ordName = tx.orderName || "";

            if (!custName && tx.sourceOrderId) {
              try {
                const res: any = await $fetch(
                  `/api/order/${tx.sourceOrderId}`,
                  {
                    params: { storeId: store.id, token: store.accessToken },
                  },
                );
                if (res.order) {
                  ordName = res.order.name || "";
                  if (res.order.customer) {
                    custName =
                      `${res.order.customer.first_name || ""} ${res.order.customer.last_name || ""}`.trim();
                  }
                  // Cache for future use this session
                  orderMap.set(tx.sourceOrderId, custName);
                  orderNameMap.set(tx.sourceOrderId, ordName);
                }
              } catch (e) {
                console.error(
                  `Failed to fetch specific order ${tx.sourceOrderId}`,
                  e,
                );
              }
            }
            if (custName) payoutTxCustomers.push(custName.toLowerCase());
            if (ordName) payoutTxOrderNames.push(ordName.toLowerCase());
          }

          // Improved matching using both Order Name and Customer Name
          const currentDomain = store.domain.toLowerCase();
          const relevantBuff1Rows = buff1Rows.filter(
            (r) => r[3]?.trim().toLowerCase() === currentDomain,
          );
          const relevantBuff2Rows = buff2Rows.filter(
            (r) => r[3]?.trim().toLowerCase() === currentDomain,
          );

          let inBuff1 = relevantBuff1Rows.some((row) => {
            const customerInSheet = String(row[7] || "").toLowerCase();
            if (!customerInSheet.trim()) return false;
            return payoutTxCustomers.some((cust: string) => {
              const custNorm = cust.toLowerCase();
              return customerInSheet.includes(custNorm);
            });
          });

          let inBuff2 = relevantBuff2Rows.some((row) => {
            const customerInSheet = String(row[7] || "").toLowerCase();
            if (!customerInSheet.trim()) return false;
            return payoutTxCustomers.some((cust: string) => {
              const custNorm = cust.toLowerCase();
              return customerInSheet.includes(custNorm);
            });
          });

          // Fallback if matching failed but store is known to be in a specific sheet
          if (!inBuff1 && !inBuff2) {
            const isBuff1Store = store.sheet?.includes("$ buff1");
            const isBuff2Store = store.sheet?.includes("$ buff2");
            // Only fallback if uniquely identified in one sheet
            if (isBuff1Store && !isBuff2Store) inBuff1 = true;
            else if (isBuff2Store && !isBuff1Store) inBuff2 = true;
          }

          if (quanLyIndex !== -1) {
            const actualRow = quanLyIndex + 1;

            let valE = inBuff1 ? payout.amount : "";
            let valF = inBuff2 ? payout.amount : "";

            quanLyUpdates.push({
              range: `'quản lý'!J${actualRow}:J${actualRow}`,
              values: [[payoutStatus]],
            });

            quanLyUpdates.push({
              range: `'quản lý'!E${actualRow}:F${actualRow}`,
              values: [[valE, valF]],
            });
          } else if (store.id === formStore.storeId) {
            const fbsMatch = fbsRows.find(
              (r) => r[2]?.trim().toLowerCase() === store.domain.toLowerCase(),
            );

            const shopName = fbsMatch?.[3] || "";
            const machineName = fbsMatch?.[4] || "";
            const bank = fbsMatch?.[19] || "";

            const buff1Amount = inBuff1 ? payout.amount : "";
            const buff2Amount = inBuff2 ? payout.amount : "";

            const newRowIndex = lastNonEmptyRow + 1 + appendedRowCount;
            appendedRowCount++;

            quanLyUpdates.push({
              range: `'quản lý'!A${newRowIndex}:J${newRowIndex}`,
              values: [
                [
                  formattedDate,
                  shopName,
                  store.domain,
                  machineName,
                  buff1Amount,
                  buff2Amount,
                  "",
                  bank,
                  "",
                  payoutStatus,
                ],
              ],
            });
            appendedMessages.push(
              `Appended ${formattedDate} - ${payout.amount} cho ${store.domain}`,
            );
          }
        }

        const sortedPayouts = [...payoutRes.payouts].sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        const latestPayout = sortedPayouts[0];
        let latestStatus = latestPayout.status.toLowerCase();
        if (latestStatus === "paid") {
          latestStatus = "Deposited";
        } else {
          latestStatus =
            latestStatus.charAt(0).toUpperCase() + latestStatus.slice(1);
        }

        paymentStore.setBulkingPayout(store.id, {
          date: latestPayout.date,
          status: latestStatus,
          sheet: store.sheet,
        });
      } else {
        paymentStore.setBulkingPayout(store.id, {
          date: "No payouts",
          status: "No Payouts",
          sheet: store.sheet,
        });
      }
    } catch (e: any) {
      paymentStore.setBulkingPayout(store.id, {
        date: "Error",
        status: "Error",
        sheet: store.sheet,
      });
    }
  }

  try {
    if (quanLyUpdates.length > 0) {
      await batchUpdateSheetValues({
        spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
        data: quanLyUpdates,
      });
      toastStore.success(
        `Đã cập nhật sheet quản lý (${quanLyUpdates.length} updates). ${appendedRowCount} rows appended.`,
      );
      if (appendedMessages.length > 0) {
        toastStore.info(appendedMessages.join("\n"), 5000);
      }
    } else {
      toastStore.info("Không có thay đổi nào cần cập nhật lên sheet quản lý.");
    }
  } catch (e) {
    console.error("Failed to execute some batch updates", e);
    toastStore.error("Cập nhật sheet quản lý thất bại. Kiểm tra console.");
  }

  isUpdating.value = false;
}

function deleteStoreOption(id: string) {
  if (confirm(`Are you sure you want to delete store ${id}?`)) {
    formStore.removeKnownStore(id);
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(id);
    }
  }
}

async function syncPayoutDates(targetId?: string | Event) {
  const target = typeof targetId === "string" ? targetId : undefined;
  isSyncingDate.value = true;
  try {
    // Now consolidated into syncTrackingNumbers for efficiency
    await syncTrackingNumbers(target);
  } finally {
    isSyncingDate.value = false;
  }
}

async function syncPayoutDatesAll() {
  if (isSyncingDate.value) return;
  isSyncingDate.value = true;
  try {
    for (const store of storeList.value) {
      if (store.domain) {
        await syncTrackingNumbers(store.id);
      }
    }
  } finally {
    isSyncingDate.value = false;
  }
}

async function syncTrackingNumbers(targetId?: string) {
  const sid = targetId || formStore.storeId;
  if (!sid) return;

  const token = resolveToken(sid);
  if (!token) {
    toastStore.error("Token expired or missing.");
    return;
  }

  const cookie = useLocalStorage<any>(sid, {}).state;
  const domain = cookie.value?.domain;
  if (!domain) {
    toastStore.error("Không tìm thấy domain cho shop này.");
    return;
  }

  isSyncingTracking.value = true;

  try {
    // 1. Fetch all orders
    const orderRes: any = await $fetch("/api/order/all", {
      method: "POST",
      body: { storeId: sid, token },
    });

    const orders: any[] = orderRes?.orders || [];
    if (!orders.length) {
      toastStore.info("Không có order nào trong shop này.");
      return;
    }

    // Build map: normalizedCustomerName -> trackingNumber
    const normalize = (s: string) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    // Map from normalized customer name to tracking numbers (from fulfillments)
    type TrackInfo = {
      customerNorm: string;
      email: string;
      trackingNr: string;
    };
    const trackInfoList: TrackInfo[] = [];

    for (const order of orders) {
      const trackingNr =
        order.fulfillments?.[0]?.tracking_number ||
        order.fulfillments?.[0]?.tracking_numbers?.[0] ||
        "";
      if (!trackingNr) continue;

      const firstName = order.customer?.first_name || "";
      const lastName = order.customer?.last_name || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const email = normalize(order.customer?.email || "");

      if (!fullName && !email) continue;

      trackInfoList.push({
        customerNorm: normalize(fullName),
        email,
        trackingNr,
      });
    }

    if (!trackInfoList.length) {
      toastStore.info("Không có order nào có tracking number.");
      return;
    }

    // 2. Read both buff sheets
    const domainNorm = normalize(domain);
    const storeSheet = getStoreSheet(sid);
    const needsBuff1 =
      storeSheet?.includes("$ buff1") ||
      storeList.value.some((s) => s.id === sid && s.sheet?.includes("$ buff1"));
    const needsBuff2 =
      storeSheet?.includes("$ buff2") ||
      storeList.value.some((s) => s.id === sid && s.sheet?.includes("$ buff2"));

    // Read both unconditionally (we'll skip updates if no domain match)
    const [b1Res, b2Res] = await Promise.allSettled([
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
        range: "'order 1'!A:Z",
      }),
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
        range: "'Sheet1'!A:Z",
      }),
    ]);

    const buff1Rows: any[][] = b1Res.status === "fulfilled" ? b1Res.value : [];
    const buff2Rows: any[][] = b2Res.status === "fulfilled" ? b2Res.value : [];

    const buff1Updates: any[] = [];
    const buff2Updates: any[] = [];

    function buildUpdates(rows: any[][], rangeSheet: string, updates: any[]) {
      rows.forEach((row, index) => {
        // col D = index 3: domain match
        const rowDomain = normalize(String(row[3] || ""));
        if (rowDomain !== domainNorm) return;

        // col H = index 7: customer name/info
        const cellH = normalize(String(row[7] || ""));
        if (!cellH) return;

        // Find matching tracking number using simple include for name
        const match = trackInfoList.find((info) => {
          return info.customerNorm && cellH.includes(info.customerNorm);
        });

        if (match) {
          const rowNum = index + 1;
          // Update Tracking in K
          updates.push({
            range: `${rangeSheet}!K${rowNum}:K${rowNum}`,
            values: [[match.trackingNr]],
          });
        }

        const rowNum = index + 1;
        // Search in customerToPayoutMap using the sheet customer name (cellH)
        // OR the matched customer name from shopify (match.customerNorm)
        let payoutDate = "";

        // 1. Check by Shopify Name if matched
        if (match && match.customerNorm) {
          payoutDate = customerToPayoutMap.get(match.customerNorm) || "";
        }

        // 2. Fallback: Search the entire cellH content against keys in customerToPayoutMap
        if (!payoutDate) {
          // If cellH contains any name that we have a payout for
          for (const [key, date] of customerToPayoutMap.entries()) {
            if (cellH.includes(key)) {
              payoutDate = date;
              break;
            }
          }
        }

        if (payoutDate) {
          updates.push({
            range: `${rangeSheet}!L${rowNum}:L${rowNum}`,
            values: [[payoutDate]],
          });
        }

        // Update status in B based on consolidated info
        if (match || payoutDate) {
          let newStatus = "";
          const hasTracking =
            (match && match.trackingNr) || String(row[10] || "").trim();
          const hasPayout = payoutDate || String(row[11] || "").trim();

          if (rangeSheet.includes("order 1")) {
            if (hasPayout) {
              newStatus = hasTracking ? "Shipped" : "Process";
            } else {
              newStatus = "Ordered";
            }
          } else {
            newStatus = hasTracking ? "Shipped" : "Ordered";
          }

          if (newStatus) {
            updates.push({
              range: `${rangeSheet}!B${rowNum}:B${rowNum}`,
              values: [[newStatus]],
            });
          }
        }
      });
    }

    // Build a map of customer name to payout date for ALL payouts of this store
    const customerToPayoutMap = new Map<string, string>();
    try {
      const [payoutRes, txRes]: any = await Promise.all([
        $fetch("/api/payment/payout/all", {
          method: "POST",
          body: { storeId: sid, token },
        }),
        $fetch("/api/payment/payout/transactions", {
          method: "POST",
          body: { storeId: sid, token },
        }),
      ]);

      const pMap = new Map();
      (payoutRes.payouts || []).forEach((p: any) => {
        // Format date to DD/MM (remove year)
        let formattedDate = p.date || "";
        if (formattedDate.includes("-")) {
          const parts = formattedDate.split("-");
          if (parts.length >= 3) {
            // YYYY-MM-DD -> DD/MM
            formattedDate = `${parts[2]}/${parts[1]}`;
          }
        }
        pMap.set(String(p.id), formattedDate);
      });

      const orderToInfoMap = new Map();
      orders.forEach((o: any) => {
        const cName = o.customer
          ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
          : "";
        const cEmail = (o.customer?.email || "").toLowerCase();
        orderToInfoMap.set(String(o.id), {
          name: normalize(cName),
          email: cEmail,
        });
      });

      (txRes.transactions || []).forEach((tx: any) => {
        if (!tx.payout_id || !tx.source_order_id) return;
        const pDate = pMap.get(String(tx.payout_id));
        const info = orderToInfoMap.get(String(tx.source_order_id));
        if (pDate && info) {
          if (info.name) customerToPayoutMap.set(info.name, pDate);
        }
      });
    } catch (e) {
      console.error("Failed to fetch payout info for consolidated sync", e);
    }

    buildUpdates(buff1Rows, "'order 1'", buff1Updates);
    buildUpdates(buff2Rows, "'Sheet1'", buff2Updates);

    const totalUpdates = buff1Updates.length + buff2Updates.length;
    if (totalUpdates === 0) {
      toastStore.info("Không tìm thấy row nào khớp trong sheet.");
      return;
    }

    const batchPromises = [];
    if (buff1Updates.length > 0) {
      batchPromises.push(
        batchUpdateSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
          data: buff1Updates,
        }),
      );
    }
    if (buff2Updates.length > 0) {
      batchPromises.push(
        batchUpdateSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
          data: buff2Updates,
        }),
      );
    }
    await Promise.allSettled(batchPromises);

    toastStore.success(
      `Đã cập nhật tracking số cho ${totalUpdates} row(s) trong sheet.`,
    );
  } catch (e: any) {
    console.error("syncTrackingNumbers error:", e);
    toastStore.error("Sync tracking thất bại. Kiểm tra console.");
  } finally {
    isSyncingTracking.value = false;
  }
}
</script>

<template>
  <div class="shop-layout-container">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="search-container">
          <svg
            class="search-icon"
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stores..."
            class="sidebar-search"
          />
        </div>
        <button
          class="btn-load-sheet"
          title="Load sheet names"
          :disabled="isLoadingPayouts"
          @click="loadPayouts"
        >
          <svg
            v-if="isLoadingPayouts"
            class="spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            />
          </svg>
          <IconsSync v-else />
        </button>
      </div>

      <div class="sidebar-content">
        <template v-if="noStores">
          <div class="sidebar-empty">
            <p>No stores found</p>
            <NuxtLink to="/manager" class="shop-bar-link">Add Store</NuxtLink>
          </div>
        </template>
        <template v-else>
          <div
            v-for="id in filteredStores"
            :key="id"
            class="sidebar-item"
            :class="{ active: formStore.storeId === id }"
          >
            <div class="sidebar-item-label" @click="onSelectStore(id)">
              {{ getStoreDomain(id) || id }}
            </div>
            <div class="sidebar-item-action-wrapper">
              <div
                v-if="getStoreSheet(id)"
                class="sidebar-item-check"
                title="Sheet loaded"
              >
                <IconsCheck width="12" height="12" />
              </div>
              <div @click.stop class="sidebar-item-actions">
                <BasePopover align="right">
                  <template #trigger="{ isOpen }">
                    <button
                      class="btn-sidebar-more"
                      :class="{ 'is-active': isOpen }"
                    >
                      <IconsMore
                        width="16"
                        height="16"
                        style="transform: rotate(90deg)"
                      />
                    </button>
                  </template>
                  <template #default="{ close }">
                    <div class="popover-menu">
                      <div
                        class="popover-item"
                        :disabled="
                          isUpdating ||
                          isSyncingDate ||
                          isFetching ||
                          !formStore.storeId
                        "
                        @click="
                          updatePayouts(id);
                          close();
                        "
                      >
                        <span v-if="isUpdating" class="spinner-inline" />
                        <IconsCheck v-else />
                        {{
                          isUpdating ? "Syncing..." : "Sync Payout (manager)"
                        }}
                      </div>
                      <div
                        class="popover-item"
                        :disabled="
                          isUpdating ||
                          isSyncingDate ||
                          isFetching ||
                          !formStore.storeId
                        "
                        @click="
                          syncPayoutDates(id);
                          close();
                        "
                      >
                        <span v-if="isSyncingDate" class="spinner-inline" />
                        <IconsDate v-else />
                        {{ isSyncingDate ? "Syncing..." : "Sync Date (staff)" }}
                      </div>
                      <div
                        class="popover-item"
                        @click="
                          deleteStoreOption(id);
                          close();
                        "
                        style="color: var(--badge-cancelled-text, #d72c0d)"
                      >
                        <IconsDelete />
                        Remove shop
                      </div>
                    </div>
                  </template>
                </BasePopover>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div class="sidebar-footer">
        <button
          class="btn-sidebar-add"
          title="Add new store"
          @click="isAddModalOpen = true"
        >
          <IconsAdd />
          <span class="btn-text">Add</span>
        </button>
        <button
          class="btn-sidebar-add"
          title="Sync Payout All"
          @click="() => updatePayouts()"
          :disabled="
            isUpdating || isSyncingDate || isFetching || storeList.length === 0
          "
        >
          <span v-if="isUpdating" class="spinner-inline" />
          <IconsCheck v-else />
          <span class="btn-text">Sync Payout All</span>
        </button>
        <button
          class="btn-sidebar-add"
          title="Sync Date All"
          @click="syncPayoutDatesAll"
          :disabled="
            isUpdating || isSyncingDate || isFetching || storeList.length === 0
          "
        >
          <span v-if="isSyncingDate" class="spinner-inline" />
          <IconsDate v-else />
          <span class="btn-text">Sync Date All</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <div class="shop-bar">
        <div class="shop-bar-left">
          <div class="title-container">
            <slot name="title" />
            <IconsArrowRight />
            <h3>
              {{ getStoreDomain(formStore.storeId) || formStore.storeId }}
            </h3>
            <span v-if="getStoreSheet(formStore.storeId)" class="sheet-badge">
              {{ getStoreSheet(formStore.storeId) }}
            </span>
          </div>
        </div>

        <div class="shop-bar-right">
          <div class="sync-group">
            <button
              class="btn-sync-action sync_payout"
              :disabled="
                isUpdating || isSyncingDate || isFetching || !formStore.storeId
              "
              @click="() => updatePayouts(formStore.storeId)"
            >
              <span v-if="isUpdating" class="spinner-inline" />
              <IconsCheck v-else />
              {{ isUpdating ? "Syncing..." : "Sync Payout (manager)" }}
            </button>
            <BasePopover align="right">
              <template #trigger>
                <button
                  class="btn-sync-settings"
                  type="button"
                  :disabled="isUpdating || isSyncingDate || !formStore.storeId"
                >
                  <IconsMore width="16" height="16" class="rotate-90" />
                </button>
              </template>
              <div class="popover-sync-content">
                <div class="sync-section">
                  <label class="section-title">Mode</label>
                  <div class="radio-group">
                    <label class="radio-item">
                      <input v-model="syncMode" type="radio" value="all" />
                      <span>All</span>
                    </label>
                    <label class="radio-item">
                      <input
                        v-model="syncMode"
                        type="radio"
                        value="from_today"
                      />
                      <span>From Today</span>
                    </label>
                  </div>
                </div>

                <div v-if="syncMode === 'from_today'" class="sync-section">
                  <label class="section-title">Count</label>
                  <BaseSelect
                    v-model="syncCount"
                    :options="[
                      { label: '1 for next', value: 1 },
                      { label: '2 for next', value: 2 },
                      { label: 'unlimit for next', value: 'unlimit' },
                    ]"
                  />
                </div>
              </div>
            </BasePopover>
          </div>

          <button
            class="btn-sync-action sync_date"
            :disabled="
              isUpdating || isSyncingDate || isFetching || !formStore.storeId
            "
            @click="() => syncPayoutDates(formStore.storeId)"
          >
            <span v-if="isSyncingDate" class="spinner-inline" />
            <IconsDate v-else />
            {{ isSyncingDate ? "Syncing..." : "Sync Date (staff)" }}
          </button>

          <button
            class="btn-fetch"
            :disabled="
              isFetching || isSyncingDate || isUpdating || !formStore.storeId
            "
            @click="fetchCurrent(true)"
          >
            <svg
              v-if="isFetching"
              class="spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              />
            </svg>
            <IconsRefresh v-else />
            {{ isFetching ? "Loading…" : "Refresh" }}
          </button>
        </div>
      </div>

      <div class="page-content">
        <slot />
      </div>
    </main>

    <!-- ── Add Store Modal ── -->
    <div
      v-if="isAddModalOpen"
      class="modal-backdrop"
      @click.self="isAddModalOpen = false"
    >
      <div class="modal-card">
        <div
          class="modal-head"
          style="
            align-items: flex-start;
            justify-content: space-between;
            display: flex;
          "
        >
          <div>
            <h3 class="modal-title">Connect New Store</h3>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <div
              class="mode-toggle"
              style="
                display: flex;
                background: var(--bg);
                border-radius: 8px;
                padding: 4px;
                border: 1px solid var(--border);
              "
            >
              <button
                class="toggle-btn"
                :class="{ active: addMode === 'single' }"
                @click="addMode = 'single'"
                style="
                  padding: 6px 12px;
                  background: transparent;
                  border: none;
                  font-size: 13px;
                  font-weight: 500;
                  border-radius: 6px;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                :style="
                  addMode === 'single'
                    ? 'background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow);'
                    : 'color: var(--text-sub);'
                "
              >
                Single
              </button>
              <button
                class="toggle-btn"
                :class="{ active: addMode === 'bulking' }"
                @click="addMode = 'bulking'"
                style="
                  padding: 6px 12px;
                  background: transparent;
                  border: none;
                  font-size: 13px;
                  font-weight: 500;
                  border-radius: 6px;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                :style="
                  addMode === 'bulking'
                    ? 'background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow);'
                    : 'color: var(--text-sub);'
                "
              >
                Bulking
              </button>
            </div>
            <button class="btn-ghost" @click="isAddModalOpen = false">✕</button>
          </div>
        </div>

        <div class="modal-body">
          <div class="field field-full">
            <label class="field-label">Domain</label>
            <input
              v-if="addMode === 'single'"
              v-model="newDomain"
              class="inp"
              placeholder="Your store domains (e.g. myshop.store)"
              @keyup.enter="addShop"
            />
            <textarea
              v-else
              v-model="newDomain"
              placeholder="Your store domains (one per line, e.g. myshop.store)"
              class="inp"
              rows="6"
            ></textarea>
          </div>
          <template v-if="addMode === 'single'">
            <div class="field field-full">
              <label class="field-label">Sock/Proxy URL</label>
              <input
                v-model="newSock"
                type="text"
                class="inp"
                placeholder="IP:Port:User:Pass"
              />
            </div>
            <div class="field-row">
              <div class="field field-50">
                <label class="field-label">Store ID</label>
                <input
                  v-model="newStoreId"
                  type="text"
                  class="inp"
                  placeholder="mystore"
                  @paste="handlePaste"
                />
              </div>
            </div>
            <div class="field-row">
              <div class="field field-50">
                <label class="field-label">Client ID</label>
                <input
                  v-model="newClientId"
                  type="text"
                  class="inp"
                  @paste="handlePaste"
                />
              </div>
              <div class="field field-50">
                <label class="field-label">Client Secret</label>
                <input
                  v-model="newClientSecret"
                  type="password"
                  class="inp"
                  @paste="handlePaste"
                />
              </div>
            </div>
          </template>

          <!-- Step Progress -->
          <div
            v-if="
              isFindingShop ||
              findShopSteps.some(
                (s) => s.status !== 'pending' && s.status !== 'done',
              )
            "
            class="step-progress"
          >
            <div
              v-for="step in findShopSteps"
              :key="step.id"
              class="step-item"
              :class="'status-' + step.status"
            >
              <div class="step-icon">
                <span v-if="step.status === 'active'" class="spinner-sm" />
                <span v-else-if="step.status === 'done'">✓</span>
                <span v-else-if="step.status === 'error'">✕</span>
                <span v-else>○</span>
              </div>
              <span class="step-label">{{ step.label }}</span>
            </div>
          </div>

          <div v-if="genError" class="alert alert-err modal-alert">
            {{ genError }}
          </div>
          <div v-if="genSuccess" class="alert alert-ok modal-alert">
            {{ genSuccess }}
          </div>
        </div>

        <div class="modal-actions">
          <button
            class="btn-ghost"
            @click="clearInputs"
            :disabled="isFindingShop"
          >
            Clear
          </button>
          <button class="btn-outline" @click="isAddModalOpen = false">
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="isFindingShop"
            @click="addShop"
          >
            {{ isFindingShop ? "Processing…" : "Add Connect" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-layout-container {
  display: flex;
  min-height: calc(100vh - 64px); /* Subtract nav height if any */
  max-width: 1400px;
  margin: 0 auto;
  gap: 24px;
  padding: 0 20px;
}

/* Sidebar Styling */
.sidebar {
  width: 286px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 12px;
  margin: 12px 0px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.sidebar-header {
  padding: 6px 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  border-bottom: 1px solid var(--border);
}

.sidebar-footer {
  padding: 8px 6px;
  display: flex;
  flex-direction: row;
  gap: 4px;
}

.search-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  border-radius: 6px;
}

.search-icon {
  position: absolute;
  left: 8px;
  color: var(--text-muted);
  pointer-events: none;
}

.sidebar-search {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px 0 30px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.sidebar-search:focus {
  background: var(--surface);
}

.btn-manage {
  color: var(--text-muted);
  display: flex;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s linear;
}

.btn-manage:hover {
  background: var(--bg);
  color: var(--text-secondary);
}

.sidebar-item-action-wrapper {
  display: flex;
  align-items: center;
}

.sidebar-item-actions {
  display: flex;
  align-items: center;
  height: 100%;
  display: none;
}
.sidebar-item:hover .sidebar-item-actions,
.sidebar-item-actions:focus-within {
  display: inline-flex;
}
.btn-sidebar-more {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.btn-sidebar-more:hover,
.btn-sidebar-more.is-active {
  color: var(--text-primary);
}

.popover-menu {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}
.popover-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
  color: var(--text-primary);
  transition: background 0.1s;
}
.popover-item:hover {
  background: #f6f6f6;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-radius: 6px;
  border: 1px solid transparent;
}

.sidebar-item:hover {
  background: var(--bg);
}

.sidebar-item.active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
  border-color: (--badge-paid-border);
}

.sidebar-item-label {
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item-check {
  color: var(--green);
  opacity: 0.8;
  flex-shrink: 0;
}
.sidebar-item:hover .sidebar-item-check {
  display: none;
}

.sidebar-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}

/* Main Content Area */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.shop-bar {
  padding: 16px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.shop-bar-left {
  flex: 1;
  min-width: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sheet-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--badge-fulfilled);
  border: 1px solid var(--badge-fulfilled-border);
  border-radius: 1rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--blue);
  letter-spacing: 0.5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shop-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sync-group {
  display: flex !important;
  align-items: stretch !important;
  border-radius: 8px !important;
  overflow: visible !important;
  border: 1px solid #dddddd !important;
  background: #f9f9f9;
  height: 32px !important;
}

.btn-sync-settings {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  background: transparent;
  border: none;
  cursor: pointer !important;
  transition: background 0.2s !important;
}

.btn-sync-settings:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.btn-sync-settings:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rotate-90 {
  transform: rotate(90deg);
}

.popover-sync-content {
  padding: 12px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sync-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.radio-group {
  display: flex;
  justify-content: space-between;
  width: 100%;
  gap: 6px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
}

.radio-item input {
  margin: 0;
}

.radio-item span {
  color: var(--text);
}

.btn-fetch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  background: var(--text-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-fetch:hover:not(:disabled) {
  filter: brightness(1.2);
}

.btn-fetch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shop-bar-link {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-load-sheet {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-load-sheet:hover:not(:disabled) {
  background: var(--surface);
  color: var(--blue);
}

.btn-load-sheet:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sync-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  color: var(--text-primary);
  border-radius: 8px;
  padding: 0 12px;
}

.sync_payout {
  height: 30px;
  border-left: none !important;
  border-top: none !important;
  border-bottom: none !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-right: 1px solid var(--border);
}

.sync_date {
  height: 32px;
  border: 1px solid var(--border);
}

.btn-sync-action:hover:not(:disabled) {
  background: #f9f9f9;
  border-color: #d1d1d1;
}

.btn-sync-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-inline {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.not-selected-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.not-selected-icon {
  width: 320px;
  height: auto;
  opacity: 0.8;
  margin-bottom: 24px;
}

.not-selected-text h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.not-selected-text p {
  font-size: 14px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .shop-layout-container {
    flex-direction: column;
    padding: 0 12px;
  }
  .sidebar {
    width: 100%;
    max-height: 200px;
  }
}

/* Sidebar Add Button */
.btn-sidebar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 0.8em;
  padding: 0 8px;
}

.btn-sidebar-add span {
  margin-left: 2px;
}

.btn-sidebar-add:hover {
  background: var(--surface);
  color: var(--blue);
}

/* Modal Styles adapted from manager.vue */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--surface);
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn-ghost {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
}
.field {
  margin-bottom: 16px;
}
.field-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.field-row .field {
  flex: 1;
  margin-bottom: 0;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
}
.inp {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}
.btn-primary {
  padding: 8px 16px;
  background: var(--blue);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-outline {
  padding: 8px 16px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.alert {
  padding: 10px 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 13px;
}
.alert-err {
  background: #fce8e8;
  color: #c0392b;
}
.alert-ok {
  background: #e4f2e8;
  color: #1a7f37;
}

/* Step Progress */
.step-progress {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #666;
}
.step-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-active {
  color: var(--blue);
  font-weight: 600;
}
.status-done {
  color: #1a7f37;
}
.status-error {
  color: #c0392b;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
