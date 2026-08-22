import type { H3Event } from "h3";
import type {
  CommerceListResponse,
  FulfillmentBulkResponse,
  FulfillmentHoldReason,
  FulfillmentMoveLocation,
  FulfillmentOrderAction,
  FulfillmentOrderCreateInput,
  FulfillmentOrderStatusFilter,
  FulfillmentOrderSummary,
  FulfillmentTrackingInput,
} from "~~/types/shopify-operations";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { requireShopifyGid } from "./shopify-commerce-ops-id";

interface FulfillmentContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface GraphqlPageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
}

interface GraphqlFulfillmentOrderLineItem {
  id: string;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  remainingQuantity: number;
  totalQuantity: number;
}

interface GraphqlFulfillmentOrder {
  id: string;
  orderId: string;
  orderName: string;
  status: string;
  requestStatus: string;
  createdAt: string;
  updatedAt: string;
  fulfillAt?: string | null;
  fulfillBy?: string | null;
  assignedLocation: {
    name: string;
    location?: { id: string } | null;
  };
  lineItems: {
    nodes: GraphqlFulfillmentOrderLineItem[];
    pageInfo: GraphqlPageInfo;
  };
  supportedActions: Array<{ action: string }>;
  fulfillmentHolds: Array<{
    id: string;
    reason: string;
    displayReason: string;
    reasonNotes?: string | null;
    heldByRequestingApp: boolean;
  }>;
  fulfillments: {
    nodes: Array<{
      id: string;
      name: string;
      status: string;
      displayStatus?: string | null;
      createdAt: string;
      updatedAt: string;
      trackingInfo: Array<{
        company?: string | null;
        number?: string | null;
        url?: string | null;
      }>;
    }>;
  };
}

interface FulfillmentOrdersData {
  fulfillmentOrders: {
    nodes: GraphqlFulfillmentOrder[];
    pageInfo: GraphqlPageInfo;
  };
}

interface FulfillmentMoveLocationsData {
  fulfillmentOrder: {
    locationsForMove: FulfillmentMoveLocationConnection;
  } | null;
}

interface FulfillmentMoveLocationConnection {
  nodes: Array<{
    location: { id: string; name: string };
    movable: boolean;
    message?: string | null;
  }>;
  pageInfo: GraphqlPageInfo;
}

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 25;
const MOVE_LOCATION_PAGE_SIZE = 50;
const MAX_MOVE_LOCATION_PAGES = 5;
const MAX_BULK_FULFILLMENTS = 25;
const BULK_CONCURRENCY = 2;

const STATUS_FILTERS = new Set<FulfillmentOrderStatusFilter>([
  "ACTIVE",
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "SCHEDULED",
  "CLOSED",
  "CANCELLED",
  "INCOMPLETE",
]);

const HOLD_REASONS = new Set<FulfillmentHoldReason>([
  "AWAITING_PAYMENT",
  "AWAITING_RETURN_ITEMS",
  "HIGH_RISK_OF_FRAUD",
  "INCORRECT_ADDRESS",
  "INVENTORY_OUT_OF_STOCK",
  "ONLINE_STORE_POST_PURCHASE_CROSS_SELL",
  "OTHER",
  "UNKNOWN_DELIVERY_DATE",
]);

export const FULFILLMENT_ORDERS_QUERY = `#graphql
  query CommerceOpsFulfillmentOrders(
    $first: Int!
    $after: String
    $query: String
    $includeClosed: Boolean!
  ) {
    fulfillmentOrders(
      first: $first
      after: $after
      query: $query
      includeClosed: $includeClosed
      sortKey: UPDATED_AT
      reverse: true
    ) {
      nodes {
        id
        orderId
        orderName
        status
        requestStatus
        createdAt
        updatedAt
        fulfillAt
        fulfillBy
        assignedLocation {
          name
          location { id }
        }
        lineItems(first: 25) {
          nodes {
            id
            productTitle
            variantTitle
            sku
            remainingQuantity
            totalQuantity
          }
          pageInfo { endCursor hasNextPage }
        }
        supportedActions { action }
        fulfillmentHolds {
          id
          reason
          displayReason
          reasonNotes
          heldByRequestingApp
        }
        fulfillments(first: 5, reverse: true) {
          nodes {
            id
            name
            status
            displayStatus
            createdAt
            updatedAt
            trackingInfo(first: 10) { company number url }
          }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const FULFILLMENT_MOVE_LOCATIONS_QUERY = `#graphql
  query CommerceOpsFulfillmentMoveLocations(
    $id: ID!
    $first: Int!
    $after: String
  ) {
    fulfillmentOrder(id: $id) {
      locationsForMove(first: $first, after: $after) {
        nodes {
          location { id name }
          movable
          message
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
`;

export function normalizeFulfillmentStatusFilter(
  value: unknown,
): FulfillmentOrderStatusFilter {
  const status = String(value || "ACTIVE")
    .trim()
    .toUpperCase() as FulfillmentOrderStatusFilter;
  if (!STATUS_FILTERS.has(status)) {
    throw createApiErrorFromMessage("Invalid fulfillment order status filter.", 400);
  }
  return status;
}

export async function fetchFulfillmentOrders(
  context: FulfillmentContext,
  input: { status?: unknown; after?: unknown; limit?: unknown } = {},
): Promise<CommerceListResponse<FulfillmentOrderSummary>> {
  const status = normalizeFulfillmentStatusFilter(input.status);
  const after = normalizeCursor(input.after);
  const limit = normalizePageSize(input.limit);
  const data = await callShopifyGraphql<
    FulfillmentOrdersData,
    {
      first: number;
      after: string | null;
      query: string | null;
      includeClosed: boolean;
    }
  >({
    ...context,
    operationName: "CommerceOpsFulfillmentOrders",
    query: FULFILLMENT_ORDERS_QUERY,
    variables: {
      first: limit,
      after,
      query: status === "ACTIVE" ? null : `status:${status.toLowerCase()}`,
      includeClosed: status !== "ACTIVE",
    },
  });

  return {
    items: data.fulfillmentOrders.nodes.map(normalizeFulfillmentOrder),
    pageInfo: {
      endCursor: data.fulfillmentOrders.pageInfo.endCursor,
      hasNextPage: data.fulfillmentOrders.pageInfo.hasNextPage,
    },
  };
}

export async function fetchFulfillmentMoveLocations(
  context: FulfillmentContext,
  idValue: unknown,
) {
  const id = requireShopifyGid(idValue, "FulfillmentOrder");
  const items = new Map<string, FulfillmentMoveLocation>();
  const seenCursors = new Set<string>();
  let after: string | null = null;
  let hasNextPage: boolean;
  let page = 0;

  do {
    const data: FulfillmentMoveLocationsData = await callShopifyGraphql<
      FulfillmentMoveLocationsData,
      { id: string; first: number; after: string | null }
    >({
      ...context,
      operationName: "CommerceOpsFulfillmentMoveLocations",
      query: FULFILLMENT_MOVE_LOCATIONS_QUERY,
      variables: { id, first: MOVE_LOCATION_PAGE_SIZE, after },
    });
    if (!data.fulfillmentOrder) {
      throw createApiErrorFromMessage("Fulfillment order was not found.", 404);
    }
    const connection: FulfillmentMoveLocationConnection =
      data.fulfillmentOrder.locationsForMove;
    for (const node of connection.nodes) {
      items.set(node.location.id, {
        id: node.location.id,
        name: node.location.name,
        movable: node.movable,
        message: String(node.message || ""),
      });
    }
    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    page += 1;
    if (hasNextPage && (!after || seenCursors.has(after))) {
      throw createApiErrorFromMessage(
        "Shopify returned an invalid move-location pagination cursor.",
        502,
      );
    }
    if (after) seenCursors.add(after);
  } while (hasNextPage && page < MAX_MOVE_LOCATION_PAGES);

  return {
    items: [...items.values()],
    truncated: hasNextPage,
  };
}

export async function runFulfillmentOrderAction(
  context: FulfillmentContext,
  action: FulfillmentOrderAction,
  idValue: unknown,
  input: Record<string, unknown> = {},
) {
  if (action === "fulfill") {
    return createFulfillment(context, idValue, input as FulfillmentOrderCreateInput);
  }
  if (action === "hold") return holdFulfillmentOrder(context, idValue, input);
  if (action === "releaseHold") {
    return releaseFulfillmentOrderHold(context, idValue, input.holdIds);
  }
  if (action === "move") {
    return moveFulfillmentOrder(context, idValue, input.locationId);
  }
  if (action === "updateTracking") {
    return updateFulfillmentTracking(
      context,
      idValue,
      input as FulfillmentTrackingInput,
    );
  }
  throw createApiErrorFromMessage("Invalid fulfillment action.", 400);
}

export async function runBulkFulfillment(
  context: FulfillmentContext,
  idValues: unknown,
  notifyCustomer: unknown,
): Promise<FulfillmentBulkResponse> {
  if (!Array.isArray(idValues) || !idValues.length) {
    throw createApiErrorFromMessage("Select at least one fulfillment order.", 400);
  }
  const ids = [
    ...new Set(idValues.map((value) => requireShopifyGid(value, "FulfillmentOrder"))),
  ];
  if (ids.length > MAX_BULK_FULFILLMENTS) {
    throw createApiErrorFromMessage(
      `Bulk fulfillment accepts at most ${MAX_BULK_FULFILLMENTS} fulfillment orders.`,
      400,
    );
  }

  const results: FulfillmentBulkResponse["results"] = new Array(ids.length);
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const index = cursor++;
      const id = ids[index]!;
      try {
        await createFulfillment(context, id, {
          notifyCustomer: notifyCustomer === true,
        });
        results[index] = {
          fulfillmentOrderId: id,
          ok: true,
          message: "Fulfillment created.",
        };
      } catch (error) {
        results[index] = {
          fulfillmentOrderId: id,
          ok: false,
          message: getServerErrorMessage(error, "Failed to create fulfillment."),
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, ids.length) }, worker),
  );
  const succeeded = results.filter((result) => result.ok).length;
  return {
    requested: ids.length,
    succeeded,
    failed: ids.length - succeeded,
    results,
  };
}

function normalizeFulfillmentOrder(
  node: GraphqlFulfillmentOrder,
): FulfillmentOrderSummary {
  const lineItems = node.lineItems.nodes.map((item) => ({
    id: item.id,
    title: String(
      item.variantTitle && item.variantTitle !== "Default Title"
        ? `${item.productTitle} · ${item.variantTitle}`
        : item.productTitle || "Item",
    ),
    sku: String(item.sku || ""),
    variantTitle: String(item.variantTitle || ""),
    remainingQuantity: Number(item.remainingQuantity || 0),
    totalQuantity: Number(item.totalQuantity || 0),
  }));
  return {
    id: node.id,
    orderId: node.orderId,
    orderName: node.orderName,
    status: node.status,
    requestStatus: node.requestStatus,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    fulfillAt: node.fulfillAt || null,
    fulfillBy: node.fulfillBy || null,
    assignedLocation: {
      id: node.assignedLocation.location?.id || null,
      name: node.assignedLocation.name,
    },
    itemCount: lineItems.reduce((total, item) => total + item.remainingQuantity, 0),
    lineItems,
    lineItemsTruncated: node.lineItems.pageInfo.hasNextPage,
    supportedActions: node.supportedActions.map((item) => item.action),
    holds: node.fulfillmentHolds.map((hold) => ({
      id: hold.id,
      reason: hold.reason,
      displayReason: hold.displayReason,
      reasonNotes: String(hold.reasonNotes || ""),
      heldByRequestingApp: hold.heldByRequestingApp,
    })),
    fulfillments: node.fulfillments.nodes.map((fulfillment) => ({
      id: fulfillment.id,
      name: fulfillment.name,
      status: fulfillment.status,
      displayStatus: fulfillment.displayStatus || null,
      createdAt: fulfillment.createdAt,
      updatedAt: fulfillment.updatedAt,
      tracking: fulfillment.trackingInfo.map((tracking) => ({
        company: String(tracking.company || ""),
        number: String(tracking.number || ""),
        url: String(tracking.url || ""),
      })),
    })),
  };
}

async function createFulfillment(
  context: FulfillmentContext,
  idValue: unknown,
  input: FulfillmentOrderCreateInput,
) {
  const id = requireShopifyGid(idValue, "FulfillmentOrder");
  const lineItems = normalizeFulfillmentLineItems(input.lineItems);
  const trackingInfo = normalizeTrackingInfo(input, false);
  const data = await callShopifyGraphql<{
    fulfillmentCreate: {
      fulfillment: { id: string; name: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsCreateFulfillment",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsCreateFulfillment($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id name status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillment: {
        notifyCustomer: input.notifyCustomer === true,
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: id,
            ...(lineItems ? { fulfillmentOrderLineItems: lineItems } : {}),
          },
        ],
        ...(trackingInfo ? { trackingInfo } : {}),
      },
    },
  });
  assertNoGraphqlUserErrors(
    data.fulfillmentCreate.userErrors,
    "Failed to create fulfillment.",
  );
  if (!data.fulfillmentCreate.fulfillment) {
    throw createApiErrorFromMessage(
      "Shopify did not return the created fulfillment.",
      502,
    );
  }
  return data.fulfillmentCreate.fulfillment;
}

async function holdFulfillmentOrder(
  context: FulfillmentContext,
  idValue: unknown,
  input: Record<string, unknown>,
) {
  const id = requireShopifyGid(idValue, "FulfillmentOrder");
  const reason = String(input.reason || "").trim() as FulfillmentHoldReason;
  if (!HOLD_REASONS.has(reason)) {
    throw createApiErrorFromMessage("Invalid fulfillment hold reason.", 400);
  }
  const reasonNotes = normalizeText(input.reasonNotes, "Hold notes", 500);
  const data = await callShopifyGraphql<{
    fulfillmentOrderHold: {
      fulfillmentOrder: { id: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsHoldFulfillmentOrder",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsHoldFulfillmentOrder(
        $id: ID!
        $fulfillmentHold: FulfillmentOrderHoldInput!
      ) {
        fulfillmentOrderHold(id: $id, fulfillmentHold: $fulfillmentHold) {
          fulfillmentOrder { id status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      id,
      fulfillmentHold: {
        reason,
        ...(reasonNotes ? { reasonNotes } : {}),
      },
    },
  });
  assertNoGraphqlUserErrors(
    data.fulfillmentOrderHold.userErrors,
    "Failed to hold fulfillment order.",
  );
  return data.fulfillmentOrderHold.fulfillmentOrder || { id, status: "ON_HOLD" };
}

async function releaseFulfillmentOrderHold(
  context: FulfillmentContext,
  idValue: unknown,
  holdIdValues: unknown,
) {
  const id = requireShopifyGid(idValue, "FulfillmentOrder");
  if (!Array.isArray(holdIdValues) || !holdIdValues.length) {
    throw createApiErrorFromMessage(
      "Select at least one app-owned fulfillment hold to release.",
      400,
    );
  }
  const holdIds = [
    ...new Set(
      holdIdValues.map((value) => requireShopifyGid(value, "FulfillmentHold")),
    ),
  ];
  if (holdIds.length > 10) {
    throw createApiErrorFromMessage(
      "At most 10 fulfillment holds can be released at once.",
      400,
    );
  }
  const data = await callShopifyGraphql<{
    fulfillmentOrderReleaseHold: {
      fulfillmentOrder: { id: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsReleaseFulfillmentOrderHold",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsReleaseFulfillmentOrderHold(
        $id: ID!
        $holdIds: [ID!]
      ) {
        fulfillmentOrderReleaseHold(id: $id, holdIds: $holdIds) {
          fulfillmentOrder { id status }
          userErrors { field message }
        }
      }
    `,
    variables: { id, holdIds },
  });
  assertNoGraphqlUserErrors(
    data.fulfillmentOrderReleaseHold.userErrors,
    "Failed to release fulfillment hold.",
  );
  return (
    data.fulfillmentOrderReleaseHold.fulfillmentOrder || {
      id,
      status: "OPEN",
    }
  );
}

async function moveFulfillmentOrder(
  context: FulfillmentContext,
  idValue: unknown,
  locationIdValue: unknown,
) {
  const id = requireShopifyGid(idValue, "FulfillmentOrder");
  const newLocationId = requireShopifyGid(locationIdValue, "Location");
  const data = await callShopifyGraphql<{
    fulfillmentOrderMove: {
      movedFulfillmentOrder: { id: string; status: string } | null;
      originalFulfillmentOrder: { id: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsMoveFulfillmentOrder",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsMoveFulfillmentOrder($id: ID!, $newLocationId: ID!) {
        fulfillmentOrderMove(id: $id, newLocationId: $newLocationId) {
          movedFulfillmentOrder { id status }
          originalFulfillmentOrder { id status }
          userErrors { field message }
        }
      }
    `,
    variables: { id, newLocationId },
  });
  assertNoGraphqlUserErrors(
    data.fulfillmentOrderMove.userErrors,
    "Failed to move fulfillment order.",
  );
  return (
    data.fulfillmentOrderMove.movedFulfillmentOrder ||
    data.fulfillmentOrderMove.originalFulfillmentOrder || { id, status: "OPEN" }
  );
}

async function updateFulfillmentTracking(
  context: FulfillmentContext,
  idValue: unknown,
  input: FulfillmentTrackingInput,
) {
  const fulfillmentId = requireShopifyGid(idValue, "Fulfillment");
  const trackingInfoInput = normalizeTrackingInfo(input, true)!;
  const data = await callShopifyGraphql<{
    fulfillmentTrackingInfoUpdate: {
      fulfillment: { id: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsUpdateFulfillmentTracking",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsUpdateFulfillmentTracking(
        $fulfillmentId: ID!
        $trackingInfoInput: FulfillmentTrackingInput!
        $notifyCustomer: Boolean
      ) {
        fulfillmentTrackingInfoUpdate(
          fulfillmentId: $fulfillmentId
          trackingInfoInput: $trackingInfoInput
          notifyCustomer: $notifyCustomer
        ) {
          fulfillment { id status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillmentId,
      trackingInfoInput,
      notifyCustomer: input.notifyCustomer === true,
    },
  });
  assertNoGraphqlUserErrors(
    data.fulfillmentTrackingInfoUpdate.userErrors,
    "Failed to update fulfillment tracking.",
  );
  if (!data.fulfillmentTrackingInfoUpdate.fulfillment) {
    throw createApiErrorFromMessage(
      "Shopify did not return the updated fulfillment.",
      502,
    );
  }
  return data.fulfillmentTrackingInfoUpdate.fulfillment;
}

function normalizeFulfillmentLineItems(
  value: FulfillmentOrderCreateInput["lineItems"],
) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length || value.length > 250) {
    throw createApiErrorFromMessage(
      "Select between 1 and 250 fulfillment order line items.",
      400,
    );
  }
  const seen = new Set<string>();
  return value.map((item) => {
    const id = requireShopifyGid(item?.id, "FulfillmentOrderLineItem");
    if (seen.has(id)) {
      throw createApiErrorFromMessage(
        "Fulfillment order line items must be unique.",
        400,
      );
    }
    seen.add(id);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw createApiErrorFromMessage(
        "Fulfillment line item quantity must be a positive integer.",
        400,
      );
    }
    return { id, quantity };
  });
}

function normalizeTrackingInfo(input: FulfillmentTrackingInput, required: boolean) {
  const company = normalizeText(input.company, "Tracking company", 100);
  const number = normalizeText(input.number, "Tracking number", 255);
  const url = normalizeTrackingUrl(input.url);
  if (!number && !url) {
    if (required) {
      throw createApiErrorFromMessage(
        "A tracking number or HTTPS tracking URL is required.",
        400,
      );
    }
    return undefined;
  }
  return {
    ...(company ? { company } : {}),
    ...(number ? { number } : {}),
    ...(url ? { url } : {}),
  };
}

function normalizeTrackingUrl(value: unknown) {
  const url = normalizeText(value, "Tracking URL", 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    throw createApiErrorFromMessage(
      "Tracking URL must be a valid HTTP or HTTPS URL.",
      400,
    );
  }
}

function normalizeText(value: unknown, field: string, maximumLength: number) {
  const text = String(value || "").trim();
  if (text.length > maximumLength) {
    throw createApiErrorFromMessage(
      `${field} must be ${maximumLength} characters or fewer.`,
      400,
    );
  }
  return text;
}

function normalizeCursor(value: unknown) {
  const cursor = String(value || "").trim();
  if (!cursor) return null;
  if (cursor.length > 2048 || /[\u0000-\u001f\u007f]/.test(cursor)) {
    throw createApiErrorFromMessage("Invalid fulfillment pagination cursor.", 400);
  }
  return cursor;
}

function normalizePageSize(value: unknown) {
  if (value === undefined || value === null || value === "") return PAGE_SIZE;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw createApiErrorFromMessage(
      `Fulfillment page size must be between 1 and ${MAX_PAGE_SIZE}.`,
      400,
    );
  }
  return limit;
}

function getServerErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as { statusMessage?: unknown; message?: unknown };
    if (typeof candidate.statusMessage === "string" && candidate.statusMessage.trim()) {
      return candidate.statusMessage.trim();
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message.trim();
    }
  }
  return fallback;
}
