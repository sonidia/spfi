import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import type {
  ShopifyInventoryLevel,
  ShopifyInventoryQuantityStateName,
} from "~~/types/shopify";

const INVENTORY_QUANTITY_NAMES: ShopifyInventoryQuantityStateName[] = [
  "available",
  "incoming",
  "committed",
  "damaged",
  "on_hand",
  "quality_control",
  "reserved",
  "safety_stock",
];
const GRAPHQL_NODE_CHUNK_SIZE = 200;

interface InventoryLevelNode {
  id: string;
  quantities: Array<{ name: string; quantity: number }>;
}

export async function enrichShopifyInventoryQuantities(
  context: { event: H3Event; storeId: string; token: string },
  levels: ShopifyInventoryLevel[],
) {
  const ids = levels
    .map((level) => String(level.admin_graphql_api_id || "").trim())
    .filter(Boolean);
  if (!ids.length) return levels;

  const nodesById = new Map<string, InventoryLevelNode>();
  for (let offset = 0; offset < ids.length; offset += GRAPHQL_NODE_CHUNK_SIZE) {
    const data = await callShopifyGraphql<{
      nodes: Array<InventoryLevelNode | null>;
    }>({
      ...context,
      operationName: "InventoryLevelQuantities",
      query: `#graphql
        query InventoryLevelQuantities($ids: [ID!]!, $names: [String!]!) {
          nodes(ids: $ids) {
            ... on InventoryLevel {
              id
              quantities(names: $names) { name quantity }
            }
          }
        }
      `,
      variables: {
        ids: ids.slice(offset, offset + GRAPHQL_NODE_CHUNK_SIZE),
        names: INVENTORY_QUANTITY_NAMES,
      },
    });
    for (const node of data.nodes) {
      if (node) nodesById.set(node.id, node);
    }
  }

  return levels.map((level) => {
    const node = nodesById.get(String(level.admin_graphql_api_id || ""));
    if (!node) return level;
    const quantities = Object.fromEntries(
      node.quantities
        .filter(isInventoryQuantity)
        .map(({ name, quantity }) => [name, quantity]),
    ) as Partial<Record<ShopifyInventoryQuantityStateName, number>>;
    return {
      ...level,
      available:
        typeof quantities.available === "number"
          ? quantities.available
          : level.available,
      quantities,
    };
  });
}

function isInventoryQuantity(value: {
  name: string;
  quantity: number;
}): value is { name: ShopifyInventoryQuantityStateName; quantity: number } {
  return (
    INVENTORY_QUANTITY_NAMES.includes(
      value.name as ShopifyInventoryQuantityStateName,
    ) && Number.isSafeInteger(value.quantity)
  );
}
