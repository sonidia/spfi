import type { H3Event } from "h3";
import type {
  OrderEditCustomItemInput,
  OrderEditLineChange,
} from "~~/types/shopify-order";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";

interface OrderEditContext {
  event: H3Event;
  storeId: string;
  token: string;
  orderEditSessionId: string;
}

interface OrderEditMutationPayload {
  userErrors: Array<{ field?: string[] | null; message: string }>;
}

interface SetQuantityData {
  orderEditSetQuantity: OrderEditMutationPayload;
}

interface AddCustomItemData {
  orderEditAddCustomItem: OrderEditMutationPayload;
}

export async function stageOrderEditLineChanges(
  context: OrderEditContext,
  changes: OrderEditLineChange[],
) {
  for (const change of normalizeLineChanges(changes)) {
    const data = await callShopifyGraphql<
      SetQuantityData,
      {
        id: string;
        lineItemId: string;
        quantity: number;
        restock: boolean;
      }
    >({
      event: context.event,
      storeId: context.storeId,
      token: context.token,
      operationName: "SetEditedOrderLineQuantity",
      retryTransport: false,
      query: `
        mutation SetEditedOrderLineQuantity(
          $id: ID!
          $lineItemId: ID!
          $quantity: Int!
          $restock: Boolean
        ) {
          orderEditSetQuantity(
            id: $id
            lineItemId: $lineItemId
            quantity: $quantity
            restock: $restock
          ) {
            userErrors { field message }
          }
        }
      `,
      variables: {
        id: context.orderEditSessionId,
        lineItemId: change.calculatedLineItemId,
        quantity: change.quantity,
        restock: change.restock,
      },
    });

    assertNoGraphqlUserErrors(
      data.orderEditSetQuantity.userErrors,
      "Failed to stage an order line item change.",
    );
  }
}

export async function stageOrderEditCustomItems(
  context: OrderEditContext,
  customItems: OrderEditCustomItemInput[],
) {
  for (const customItem of normalizeCustomItems(customItems)) {
    const variables = {
      id: context.orderEditSessionId,
      title: customItem.title,
      price: {
        amount: customItem.price,
        currencyCode: customItem.currencyCode,
      },
      quantity: customItem.quantity,
      requiresShipping: customItem.requiresShipping,
      taxable: customItem.taxable,
      ...(customItem.locationId ? { locationId: customItem.locationId } : {}),
    };
    const data = await callShopifyGraphql<AddCustomItemData, typeof variables>({
      event: context.event,
      storeId: context.storeId,
      token: context.token,
      operationName: "AddCustomItemToOrderEdit",
      retryTransport: false,
      query: `
        mutation AddCustomItemToOrderEdit(
          $id: ID!
          $title: String!
          $price: MoneyInput!
          $quantity: Int!
          $locationId: ID
          $requiresShipping: Boolean
          $taxable: Boolean
        ) {
          orderEditAddCustomItem(
            id: $id
            title: $title
            price: $price
            quantity: $quantity
            locationId: $locationId
            requiresShipping: $requiresShipping
            taxable: $taxable
          ) {
            userErrors { field message }
          }
        }
      `,
      variables,
    });

    assertNoGraphqlUserErrors(
      data.orderEditAddCustomItem.userErrors,
      "Failed to stage a custom order item.",
    );
  }
}

export async function assertOrderEditSessionExists(context: OrderEditContext) {
  const data = await callShopifyGraphql<
    { orderEditSession: { id: string } | null },
    { id: string }
  >({
    event: context.event,
    storeId: context.storeId,
    token: context.token,
    operationName: "CheckOrderEditSession",
    retryTransport: false,
    query: `
      query CheckOrderEditSession($id: ID!) {
        orderEditSession(id: $id) { id }
      }
    `,
    variables: { id: context.orderEditSessionId },
  });

  if (!data.orderEditSession) {
    throw createApiErrorFromMessage(
      "The order edit session is missing, expired, or already committed.",
      409,
    );
  }
}

function normalizeLineChanges(changes: OrderEditLineChange[]) {
  return changes.map((change) => {
    const quantity = Number(change.quantity);
    const calculatedLineItemId = String(change.calculatedLineItemId || "").trim();

    if (!calculatedLineItemId || !Number.isInteger(quantity) || quantity < 0) {
      throw createApiErrorFromMessage(
        "Each edit requires a calculated line item ID and a non-negative integer quantity.",
        400,
      );
    }

    return {
      calculatedLineItemId: toShopifyGid("CalculatedLineItem", calculatedLineItemId),
      quantity,
      restock: Boolean(change.restock),
    };
  });
}

function normalizeCustomItems(customItems: OrderEditCustomItemInput[]) {
  return customItems.map((customItem) => {
    const title = String(customItem.title || "").trim();
    const price = String(customItem.price ?? "").trim();
    const currencyCode = String(customItem.currencyCode || "")
      .trim()
      .toUpperCase();
    const quantity = Number(customItem.quantity);
    const locationId = String(customItem.locationId || "").trim();

    if (!title) {
      throw createApiErrorFromMessage("Each custom item requires a title.", 400);
    }
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(price) || !Number.isFinite(Number(price))) {
      throw createApiErrorFromMessage(
        "Each custom item price must be a non-negative decimal amount.",
        400,
      );
    }
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw createApiErrorFromMessage(
        "Each custom item requires a three-letter currency code.",
        400,
      );
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw createApiErrorFromMessage(
        "Each custom item quantity must be a positive integer.",
        400,
      );
    }

    return {
      title,
      price,
      currencyCode,
      quantity,
      requiresShipping: Boolean(customItem.requiresShipping),
      taxable: typeof customItem.taxable === "boolean" ? customItem.taxable : true,
      ...(locationId ? { locationId: toShopifyGid("Location", locationId) } : {}),
    };
  });
}
