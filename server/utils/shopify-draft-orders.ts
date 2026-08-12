import type { H3Event } from "h3";
import type {
  CommerceListResponse,
  DraftOrderAction,
  DraftOrderCreateInput,
  DraftOrderSummary,
} from "~~/types/shopify-operations";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { requireShopifyGid } from "./shopify-commerce-ops-id";

interface DraftOrderNode {
  id: string;
  name: string;
  status: string;
  email?: string | null;
  createdAt: string;
  updatedAt: string;
  invoiceSentAt?: string | null;
  completedAt?: string | null;
  invoiceUrl?: string | null;
  totalPriceSet: {
    presentmentMoney: { amount: string; currencyCode: string };
  };
  customer?: { displayName?: string | null; email?: string | null } | null;
  totalQuantityOfLineItems: number;
  order?: { id: string } | null;
}

interface DraftOrderContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface UserError {
  field?: string[] | null;
  message: string;
}

export async function fetchDraftOrders(
  context: DraftOrderContext,
): Promise<CommerceListResponse<DraftOrderSummary>> {
  const data = await callShopifyGraphql<{
    draftOrders: {
      nodes: DraftOrderNode[];
      pageInfo: { endCursor?: string | null; hasNextPage: boolean };
    };
  }>({
    ...context,
    operationName: "CommerceOpsDraftOrders",
    query: `#graphql
      query CommerceOpsDraftOrders($first: Int!) {
        draftOrders(first: $first, reverse: true, sortKey: UPDATED_AT) {
          nodes {
            id name status email createdAt updatedAt invoiceSentAt completedAt
            invoiceUrl
            totalPriceSet { presentmentMoney { amount currencyCode } }
            customer { displayName email }
            totalQuantityOfLineItems
            order { id }
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    `,
    variables: { first: 50 },
  });

  return {
    items: data.draftOrders.nodes.map(mapDraftOrder),
    pageInfo: {
      endCursor: data.draftOrders.pageInfo.endCursor || null,
      hasNextPage: data.draftOrders.pageInfo.hasNextPage,
    },
  };
}

export async function createDraftOrder(
  context: DraftOrderContext,
  input: DraftOrderCreateInput,
) {
  const currencyCode = String(input.currencyCode || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw createApiErrorFromMessage("Currency must be a three-letter code.", 400);
  }
  if (!Array.isArray(input.lineItems) || !input.lineItems.length) {
    throw createApiErrorFromMessage("Add at least one draft order item.", 400);
  }
  if (input.lineItems.length > 100) {
    throw createApiErrorFromMessage("A draft is limited to 100 items here.", 400);
  }

  const lineItems = input.lineItems.map((item) => {
    const title = String(item.title || "").trim();
    const quantity = Number(item.quantity);
    const amount = String(item.unitPrice || "").trim();
    if (!title || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw createApiErrorFromMessage(
        "Each draft item needs a title and positive integer quantity.",
        400,
      );
    }
    if (!/^\d+(?:\.\d{1,6})?$/.test(amount) || Number(amount) < 0) {
      throw createApiErrorFromMessage("Each draft item needs a valid price.", 400);
    }
    return {
      title,
      quantity,
      originalUnitPriceWithCurrency: { amount, currencyCode },
      requiresShipping: item.requiresShipping !== false,
      taxable: item.taxable !== false,
    };
  });
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const draftInput = {
    presentmentCurrencyCode: currencyCode,
    lineItems,
    ...(String(input.email || "").trim() ? { email: String(input.email).trim() } : {}),
    ...(String(input.note || "").trim() ? { note: String(input.note).trim() } : {}),
    ...(tags.length ? { tags } : {}),
    acceptAutomaticDiscounts: true,
    allowDiscountCodesInCheckout: true,
    visibleToCustomer: true,
  };
  const data = await callShopifyGraphql<{
    draftOrderCreate: { draftOrder: DraftOrderNode | null; userErrors: UserError[] };
  }>({
    ...context,
    operationName: "CommerceOpsCreateDraftOrder",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsCreateDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id name status email createdAt updatedAt invoiceSentAt completedAt
            invoiceUrl
            totalPriceSet { presentmentMoney { amount currencyCode } }
            customer { displayName email }
            totalQuantityOfLineItems
            order { id }
          }
          userErrors { field message }
        }
      }
    `,
    variables: { input: draftInput },
  });
  assertNoGraphqlUserErrors(
    data.draftOrderCreate.userErrors,
    "Failed to create the draft order.",
  );
  if (!data.draftOrderCreate.draftOrder) {
    throw createApiErrorFromMessage("Shopify did not return the draft order.", 502);
  }
  return mapDraftOrder(data.draftOrderCreate.draftOrder);
}

export async function runDraftOrderAction(
  context: DraftOrderContext,
  idValue: unknown,
  action: DraftOrderAction,
) {
  const id = requireShopifyGid(idValue, "DraftOrder");
  if (action === "complete") {
    const data = await callShopifyGraphql<{
      draftOrderComplete: {
        draftOrder: { id: string; order?: { id: string } | null } | null;
        userErrors: UserError[];
      };
    }>({
      ...context,
      operationName: "CommerceOpsCompleteDraftOrder",
      retryTransport: false,
      query: `#graphql
        mutation CommerceOpsCompleteDraftOrder($id: ID!) {
          draftOrderComplete(id: $id) {
            draftOrder { id order { id } }
            userErrors { field message }
          }
        }
      `,
      variables: { id },
    });
    assertNoGraphqlUserErrors(
      data.draftOrderComplete.userErrors,
      "Failed to complete the draft order.",
    );
    return { id, orderId: data.draftOrderComplete.draftOrder?.order?.id || null };
  }

  if (action === "invoice") {
    const data = await callShopifyGraphql<{
      draftOrderInvoiceSend: {
        draftOrder: { id: string } | null;
        userErrors: UserError[];
      };
    }>({
      ...context,
      operationName: "CommerceOpsSendDraftInvoice",
      retryTransport: false,
      query: `#graphql
        mutation CommerceOpsSendDraftInvoice($id: ID!) {
          draftOrderInvoiceSend(id: $id) {
            draftOrder { id }
            userErrors { field message }
          }
        }
      `,
      variables: { id },
    });
    assertNoGraphqlUserErrors(
      data.draftOrderInvoiceSend.userErrors,
      "Failed to send the draft invoice.",
    );
    return { id };
  }

  const data = await callShopifyGraphql<{
    draftOrderDelete: { deletedId: string | null; userErrors: UserError[] };
  }>({
    ...context,
    operationName: "CommerceOpsDeleteDraftOrder",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsDeleteDraftOrder($input: DraftOrderDeleteInput!) {
        draftOrderDelete(input: $input) {
          deletedId
          userErrors { field message }
        }
      }
    `,
    variables: { input: { id } },
  });
  assertNoGraphqlUserErrors(
    data.draftOrderDelete.userErrors,
    "Failed to delete the draft order.",
  );
  return { id: data.draftOrderDelete.deletedId || id };
}

function mapDraftOrder(node: DraftOrderNode): DraftOrderSummary {
  return {
    id: node.id,
    name: node.name,
    status: node.status,
    email: String(node.email || node.customer?.email || ""),
    customerName: String(node.customer?.displayName || ""),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    invoiceSentAt: node.invoiceSentAt || null,
    completedAt: node.completedAt || null,
    invoiceUrl: node.invoiceUrl || null,
    totalPrice: node.totalPriceSet.presentmentMoney,
    itemCount: Number(node.totalQuantityOfLineItems || 0),
    orderId: node.order?.id || null,
  };
}
