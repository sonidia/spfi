import type {
  CheckSeverity,
  StoreCheckResult,
  StoreLifecycleStatus,
} from "~~/types/store-status";

interface ShopifyFetchSnapshot {
  ok: boolean;
  status: number | null;
  statusText: string;
  bodySnippet: string;
  contentType: string;
  error?: string;
}

interface ShopifyStatusInput {
  website: ShopifyFetchSnapshot;
  http: ShopifyFetchSnapshot;
  endpoint: ShopifyFetchSnapshot;
}

interface ShopifyStatusClassification {
  status: StoreLifecycleStatus;
  severity: CheckSeverity;
  summary: string;
  details: string[];
}

const DEAD_TEXT_MARKERS = [
  "this store is unavailable",
  "sorry, this shop is currently unavailable",
  "store not found",
];

export function classifyShopifyStoreStatus({
  website,
  http,
  endpoint,
}: ShopifyStatusInput): ShopifyStatusClassification {
  const deadSignal = getExplicitDeadSignal([website, endpoint]);

  if (deadSignal) {
    return {
      status: "dead",
      severity: "danger",
      summary: "Shopify returned a dead-store marker.",
      details: [deadSignal],
    };
  }

  const aliveEvidence = getAliveEvidence(website, http, endpoint);

  if (aliveEvidence.length) {
    return {
      status: "alive",
      severity: "ok",
      summary: "Public Shopify signals show the store is reachable.",
      details: aliveEvidence,
    };
  }

  const deadEvidence = getDeadEvidence(website, http, endpoint);

  return {
    status: "dead",
    severity: "danger",
    summary: "Public Shopify signals did not show a reachable store.",
    details: deadEvidence.length ? deadEvidence : ["No alive signal was found."],
  };
}

export function buildShopifyStatusVerdict(
  classification: ShopifyStatusClassification,
): StoreCheckResult["verdict"] {
  return {
    status: classification.status,
    severity: classification.severity,
    summary: classification.summary,
  };
}

function getExplicitDeadSignal(snapshots: ShopifyFetchSnapshot[]) {
  for (const snapshot of snapshots) {
    const body = snapshot.bodySnippet.toLowerCase();
    const marker = DEAD_TEXT_MARKERS.find((item) => body.includes(item));

    if (marker) {
      return `Matched Shopify dead marker: "${marker}".`;
    }

    if (body.includes('"errors"') && body.includes("not found")) {
      return 'Shopify endpoint returned "errors: not found".';
    }
  }

  return "";
}

function getAliveEvidence(
  website: ShopifyFetchSnapshot,
  http: ShopifyFetchSnapshot,
  endpoint: ShopifyFetchSnapshot,
) {
  const evidence: string[] = [];

  if (isProductsEndpointAlive(endpoint)) {
    evidence.push("Shopify products endpoint returned successful JSON.");
  }

  if (isStorefrontResponseAlive(http)) {
    evidence.push(`Storefront HTTP response is ${formatStatus(http)}.`);
  }

  if (isStorefrontResponseAlive(website)) {
    evidence.push(`Storefront page response is ${formatStatus(website)}.`);
  }

  return evidence;
}

function getDeadEvidence(
  website: ShopifyFetchSnapshot,
  http: ShopifyFetchSnapshot,
  endpoint: ShopifyFetchSnapshot,
) {
  return [website, http, endpoint]
    .map((snapshot) => {
      if (snapshot.error) {
        return `Request failed: ${snapshot.error}`;
      }

      if (isDeadHttpStatus(snapshot.status)) {
        return `Dead HTTP status: ${formatStatus(snapshot)}.`;
      }

      return "";
    })
    .filter(Boolean);
}

function isProductsEndpointAlive(snapshot: ShopifyFetchSnapshot) {
  return (
    !snapshot.error &&
    snapshot.ok &&
    snapshot.contentType.toLowerCase().includes("json")
  );
}

function isStorefrontResponseAlive(snapshot: ShopifyFetchSnapshot) {
  const status = snapshot.status || 0;

  return (
    !snapshot.error &&
    ((status >= 200 && status < 400) || status === 401 || status === 403)
  );
}

function isDeadHttpStatus(status: number | null) {
  return status === 404 || status === 410 || Boolean(status && status >= 500);
}

function formatStatus(snapshot: ShopifyFetchSnapshot) {
  return `HTTP ${snapshot.status} ${snapshot.statusText}`.trim();
}

