import type { H3Event } from "h3";
import type {
  AbandonedCheckoutSummary,
  CommerceListResponse,
} from "~~/types/shopify-operations";
import { callShopifyGraphql } from "./callShopifyGraphql";

interface CheckoutContext {
  event: H3Event;
  storeId: string;
  token: string;
}

export async function fetchAbandonedCheckouts(
  context: CheckoutContext,
): Promise<CommerceListResponse<AbandonedCheckoutSummary>> {
  const data = await callShopifyGraphql<{
    abandonedCheckouts: {
      nodes: Array<{
        id: string;
        name: string;
        abandonedCheckoutUrl: string;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | null;
        discountCodes: string[];
        customer?: {
          displayName?: string | null;
          email?: string | null;
        } | null;
        totalPriceSet: {
          presentmentMoney: { amount: string; currencyCode: string };
        };
        lineItemsQuantity: number;
        lineItems: { nodes: Array<{ title?: string | null }> };
      }>;
      pageInfo: { endCursor?: string | null; hasNextPage: boolean };
    };
  }>({
    ...context,
    operationName: "CommerceOpsAbandonedCheckouts",
    query: `#graphql
      query CommerceOpsAbandonedCheckouts($first: Int!) {
        abandonedCheckouts(first: $first, reverse: true, sortKey: UPDATED_AT) {
          nodes {
            id name abandonedCheckoutUrl createdAt updatedAt completedAt discountCodes
            customer { displayName email }
            totalPriceSet { presentmentMoney { amount currencyCode } }
            lineItemsQuantity
            lineItems(first: 3) { nodes { title } }
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    `,
    variables: { first: 50 },
  });

  return {
    items: data.abandonedCheckouts.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      customerName: String(node.customer?.displayName || ""),
      email: String(node.customer?.email || ""),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      completedAt: node.completedAt || null,
      recoveryUrl: node.abandonedCheckoutUrl,
      totalPrice: node.totalPriceSet.presentmentMoney,
      itemCount: Number(node.lineItemsQuantity || 0),
      itemTitles: node.lineItems.nodes
        .map((item) => String(item.title || "").trim())
        .filter(Boolean),
      discountCodes: node.discountCodes || [],
    })),
    pageInfo: {
      endCursor: data.abandonedCheckouts.pageInfo.endCursor || null,
      hasNextPage: data.abandonedCheckouts.pageInfo.hasNextPage,
    },
  };
}
