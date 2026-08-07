import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  stageOrderEditCustomItems,
  stageOrderEditLineChanges,
} from "~~/server/utils/shopify-order-edit";
import type {
  OrderEditCommitInput,
  OrderEditCommitResponse,
} from "~~/types/shopify-order";

interface CommitEditBody extends OrderEditCommitInput {
  storeId?: string;
  token?: string;
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
  const customItems = Array.isArray(body.customItems) ? body.customItems : [];

  if (!orderId || !storeId || !token || !calculatedOrderId) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and calculated order ID are required.",
      400,
    );
  }
  if (!changes.length && !customItems.length) {
    throw createApiErrorFromMessage("No order item changes were provided.", 400);
  }
  const calculatedId = toShopifyGid("CalculatedOrder", calculatedOrderId);
  const editContext = {
    event,
    storeId,
    token,
    calculatedOrderId: calculatedId,
  };

  await stageOrderEditLineChanges(editContext, changes);
  await stageOrderEditCustomItems(editContext, customItems);

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
