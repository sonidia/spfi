import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type {
  OrderEditCommitInput,
  OrderEditCommitResponse,
} from "~~/types/shopify-order";

interface CommitEditBody extends OrderEditCommitInput {
  storeId?: string;
  token?: string;
}

interface SetQuantityData {
  orderEditSetQuantity: {
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

interface CommitEditData {
  orderEditCommit: {
    order: { id: string } | null;
    successMessages: string[] | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event): Promise<OrderEditCommitResponse> => {
  const orderId = String(event.context.params?.id || "");
  const body = (await readBody<CommitEditBody>(event)) || ({} as CommitEditBody);
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const calculatedOrderId = String(body.calculatedOrderId || "").trim();
  const changes = Array.isArray(body.changes) ? body.changes : [];

  if (!orderId || !storeId || !token || !calculatedOrderId) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and calculated order ID are required.",
      400,
    );
  }
  if (!changes.length) {
    throw createApiErrorFromMessage("No line item changes were provided.", 400);
  }

  const normalizedChanges = changes.map((change) => {
    const quantity = Number(change.quantity);
    const calculatedLineItemId = String(
      change.calculatedLineItemId || "",
    ).trim();

    if (!calculatedLineItemId || !Number.isInteger(quantity) || quantity < 0) {
      throw createApiErrorFromMessage(
        "Each edit requires a calculated line item ID and a non-negative integer quantity.",
        400,
      );
    }

    return {
      calculatedLineItemId: toShopifyGid(
        "CalculatedLineItem",
        calculatedLineItemId,
      ),
      quantity,
      restock: Boolean(change.restock),
    };
  });

  const calculatedId = toShopifyGid("CalculatedOrder", calculatedOrderId);
  for (const change of normalizedChanges) {
    const staged = await callShopifyGraphql<
      SetQuantityData,
      { id: string; lineItemId: string; quantity: number; restock: boolean }
    >({
      event,
      storeId,
      token,
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
        id: calculatedId,
        lineItemId: change.calculatedLineItemId,
        quantity: change.quantity,
        restock: change.restock,
      },
    });

    assertNoGraphqlUserErrors(
      staged.orderEditSetQuantity.userErrors,
      "Failed to stage an order line item change.",
    );
  }

  const committed = await callShopifyGraphql<
    CommitEditData,
    { id: string; notifyCustomer: boolean; staffNote?: string }
  >({
    event,
    storeId,
    token,
    operationName: "CommitOrderEdit",
    retryTransport: false,
    query: `
      mutation CommitOrderEdit(
        $id: ID!
        $notifyCustomer: Boolean
        $staffNote: String
      ) {
        orderEditCommit(
          id: $id
          notifyCustomer: $notifyCustomer
          staffNote: $staffNote
        ) {
          order { id }
          successMessages
          userErrors { field message }
        }
      }
    `,
    variables: {
      id: calculatedId,
      notifyCustomer: Boolean(body.notifyCustomer),
      ...(body.staffNote?.trim() ? { staffNote: body.staffNote.trim() } : {}),
    },
  });

  assertNoGraphqlUserErrors(
    committed.orderEditCommit.userErrors,
    "Failed to commit the order edit.",
  );
  if (!committed.orderEditCommit.order) {
    throw createApiErrorFromMessage(
      "Shopify did not return the edited order.",
      502,
    );
  }

  return {
    orderId: committed.orderEditCommit.order.id,
    successMessages: committed.orderEditCommit.successMessages || [],
  };
});
