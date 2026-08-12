import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  assertOrderEditSessionExists,
  stageOrderEditCustomItems,
  stageOrderEditLineChanges,
} from "~~/server/utils/shopify-order-edit";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";
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
  requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<CommitEditBody>(event)) || ({} as CommitEditBody);
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const orderEditSessionId = String(body.orderEditSessionId || "").trim();
  const changes = Array.isArray(body.changes) ? body.changes : [];
  const customItems = Array.isArray(body.customItems) ? body.customItems : [];

  if (!storeId || !token || !orderEditSessionId) {
    throw createApiErrorFromMessage(
      "Store ID, Access Token and order edit session ID are required.",
      400,
    );
  }
  if (!changes.length && !customItems.length) {
    throw createApiErrorFromMessage("No order item changes were provided.", 400);
  }
  const sessionId = toShopifyGid("OrderEditSession", orderEditSessionId);
  const editContext = {
    event,
    storeId,
    token,
    orderEditSessionId: sessionId,
  };

  await assertOrderEditSessionExists(editContext);

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
      id: sessionId,
      notifyCustomer: Boolean(body.notifyCustomer),
      ...(body.staffNote?.trim() ? { staffNote: body.staffNote.trim() } : {}),
    },
  });

  assertNoGraphqlUserErrors(
    committed.orderEditCommit.userErrors,
    "Failed to commit the order edit.",
  );
  if (!committed.orderEditCommit.order) {
    throw createApiErrorFromMessage("Shopify did not return the edited order.", 502);
  }

  return {
    orderId: committed.orderEditCommit.order.id,
    successMessages: committed.orderEditCommit.successMessages || [],
  };
});
