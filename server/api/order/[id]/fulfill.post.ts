import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
} from "~~/server/utils/callShopifyGraphql";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import {
  buildShopifyFulfillmentGroups,
  type GraphqlFulfillmentGroupInput,
} from "~~/server/utils/shopify-fulfillment";
import type { ShopifyFulfillmentOrder } from "~~/types/shopify";
import type { OrderFulfillmentInput } from "~~/types/shopify-order";

interface OrderFulfillBody {
  storeId?: string;
  token?: string;
  fulfillment?: Partial<OrderFulfillmentInput>;
}

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

interface GraphqlFulfillmentInput {
  notifyCustomer: boolean;
  lineItemsByFulfillmentOrder: GraphqlFulfillmentGroupInput[];
  trackingInfo?: {
    number?: string;
    company?: string;
    url?: string;
  };
}

interface FulfillmentCreateData {
  fulfillmentCreate: {
    fulfillment: { id: string } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

const FULFILLMENT_CREATE_MUTATION = `#graphql
  mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const orderId = requireShopifyResourceId(
    event.context.params?.id,
    "Order",
  );
  const body = (await readBody<OrderFulfillBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const fulfillmentInfo = body.fulfillment || {};

  const response = await callShopifyApi<FulfillmentOrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/fulfillment_orders.json`,
    missingProxyMessage: "Missing sock proxy.",
    preserveUnsafeIntegers: true,
  });
  const lineItemsByFulfillmentOrder = buildShopifyFulfillmentGroups(
    fulfillmentInfo.line_items_by_fulfillment_order,
    response.fulfillment_orders || [],
  );
  const trackingInfo = buildTrackingInfo(fulfillmentInfo, appConfig.tracking);
  const data = await callShopifyGraphql<
    FulfillmentCreateData,
    { fulfillment: GraphqlFulfillmentInput }
  >({
    event,
    storeId,
    token,
    query: FULFILLMENT_CREATE_MUTATION,
    operationName: "CreateFulfillment",
    retryTransport: false,
    variables: {
      fulfillment: {
        notifyCustomer: fulfillmentInfo.notify_customer !== false,
        lineItemsByFulfillmentOrder,
        ...(trackingInfo ? { trackingInfo } : {}),
      },
    },
  });
  const result = data.fulfillmentCreate;
  assertNoGraphqlUserErrors(result.userErrors, "Failed to fulfill order.");

  if (!result.fulfillment) {
    throw createApiErrorFromMessage(
      "Shopify did not return the created fulfillment.",
      502,
    );
  }

  return { fulfillment: result.fulfillment };
});

function buildTrackingInfo(
  fulfillment: Partial<OrderFulfillmentInput>,
  defaults: { company?: unknown; url?: unknown },
) {
  const trackingNumber = String(
    fulfillment.tracking_info?.number || "",
  ).trim();
  const trackingCompany = String(
    fulfillment.tracking_info?.company || defaults.company || "",
  ).trim();
  const canUseDefaultTrackingUrl =
    trackingNumber &&
    trackingCompany.toLowerCase() ===
      String(defaults.company || "").trim().toLowerCase();
  const trackingUrl = String(
    fulfillment.tracking_info?.url ||
      (canUseDefaultTrackingUrl
        ? `${String(defaults.url || "")}${trackingNumber}`
        : ""),
  ).trim();

  if (!trackingNumber && !trackingUrl) return undefined;

  return {
    ...(trackingNumber ? { number: trackingNumber } : {}),
    ...(trackingCompany ? { company: trackingCompany } : {}),
    ...(trackingUrl ? { url: trackingUrl } : {}),
  };
}
