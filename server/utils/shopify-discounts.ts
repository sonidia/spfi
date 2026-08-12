import type { H3Event } from "h3";
import type {
  CommerceListResponse,
  DiscountAction,
  DiscountCreateInput,
  DiscountSummary,
} from "~~/types/shopify-operations";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { requireShopifyGid } from "./shopify-commerce-ops-id";

interface DiscountContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface DiscountNode {
  id: string;
  discount: {
    __typename: string;
    title?: string;
    summary?: string;
    status?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    asyncUsageCount?: number;
    codes?: { nodes?: Array<{ code: string }> };
  };
}

interface UserError {
  field?: string[] | null;
  message: string;
}

const NATIVE_DISCOUNT_FIELDS = `
  title summary status startsAt endsAt asyncUsageCount
`;

const APP_DISCOUNT_FIELDS = `
  title status startsAt endsAt asyncUsageCount
`;

export async function fetchDiscounts(
  context: DiscountContext,
): Promise<CommerceListResponse<DiscountSummary>> {
  const data = await callShopifyGraphql<{
    discountNodes: {
      nodes: DiscountNode[];
      pageInfo: { endCursor?: string | null; hasNextPage: boolean };
    };
  }>({
    ...context,
    operationName: "CommerceOpsDiscounts",
    query: `#graphql
      query CommerceOpsDiscounts($first: Int!) {
        discountNodes(first: $first, reverse: true, sortKey: UPDATED_AT) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountCodeBasic { ${NATIVE_DISCOUNT_FIELDS} codes(first: 1) { nodes { code } } }
              ... on DiscountAutomaticBasic { ${NATIVE_DISCOUNT_FIELDS} }
              ... on DiscountCodeBxgy { ${NATIVE_DISCOUNT_FIELDS} codes(first: 1) { nodes { code } } }
              ... on DiscountAutomaticBxgy { ${NATIVE_DISCOUNT_FIELDS} }
              ... on DiscountCodeFreeShipping { ${NATIVE_DISCOUNT_FIELDS} codes(first: 1) { nodes { code } } }
              ... on DiscountAutomaticFreeShipping { ${NATIVE_DISCOUNT_FIELDS} }
              ... on DiscountCodeApp { ${APP_DISCOUNT_FIELDS} codes(first: 1) { nodes { code } } }
              ... on DiscountAutomaticApp { ${APP_DISCOUNT_FIELDS} }
            }
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    `,
    variables: { first: 50 },
  });

  return {
    items: data.discountNodes.nodes.map((node) => ({
      id: node.id,
      type: node.discount.__typename || "Discount",
      title: String(node.discount.title || "Untitled discount"),
      code: node.discount.codes?.nodes?.[0]?.code || null,
      summary: String(node.discount.summary || ""),
      status: String(node.discount.status || "UNKNOWN"),
      startsAt: node.discount.startsAt || null,
      endsAt: node.discount.endsAt || null,
      usageCount: Number(node.discount.asyncUsageCount || 0),
    })),
    pageInfo: {
      endCursor: data.discountNodes.pageInfo.endCursor || null,
      hasNextPage: data.discountNodes.pageInfo.hasNextPage,
    },
  };
}

export async function createDiscount(
  context: DiscountContext,
  input: DiscountCreateInput,
) {
  const title = String(input.title || "").trim();
  const code = String(input.code || "")
    .trim()
    .toUpperCase();
  const value = String(input.value || "").trim();
  if (!title || !code || code.length > 255 || /\s/.test(code)) {
    throw createApiErrorFromMessage(
      "A title and valid discount code are required.",
      400,
    );
  }
  if (!/^\d+(?:\.\d{1,6})?$/.test(value) || Number(value) <= 0) {
    throw createApiErrorFromMessage("Discount value must be greater than zero.", 400);
  }
  if (input.valueType === "percentage" && Number(value) > 100) {
    throw createApiErrorFromMessage("Percentage discounts cannot exceed 100%.", 400);
  }
  const startsAt = normalizeDate(input.startsAt) || new Date().toISOString();
  const endsAt = normalizeDate(input.endsAt);
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw createApiErrorFromMessage(
      "Discount end date must be after its start date.",
      400,
    );
  }
  const usageLimit =
    input.usageLimit === null || input.usageLimit === undefined
      ? null
      : Number(input.usageLimit);
  if (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit <= 0)) {
    throw createApiErrorFromMessage("Usage limit must be a positive integer.", 400);
  }

  const basicCodeDiscount = {
    title,
    code,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    context: { all: "ALL" },
    customerGets: {
      value:
        input.valueType === "percentage"
          ? { percentage: Number(value) / 100 }
          : { discountAmount: { amount: value, appliesOnEachItem: false } },
      items: { all: true },
    },
    appliesOncePerCustomer: input.appliesOncePerCustomer === true,
    ...(usageLimit !== null ? { usageLimit } : {}),
  };
  const data = await callShopifyGraphql<{
    discountCodeBasicCreate: {
      codeDiscountNode: { id: string } | null;
      userErrors: UserError[];
    };
  }>({
    ...context,
    operationName: "CommerceOpsCreateDiscount",
    retryTransport: false,
    query: `#graphql
      mutation CommerceOpsCreateDiscount($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }
    `,
    variables: { input: basicCodeDiscount },
  });
  assertNoGraphqlUserErrors(
    data.discountCodeBasicCreate.userErrors,
    "Failed to create the discount.",
  );
  if (!data.discountCodeBasicCreate.codeDiscountNode) {
    throw createApiErrorFromMessage("Shopify did not return the discount.", 502);
  }
  return { id: data.discountCodeBasicCreate.codeDiscountNode.id };
}

export async function runDiscountAction(
  context: DiscountContext,
  idValue: unknown,
  action: DiscountAction,
) {
  const id = requireShopifyGid(idValue, "DiscountCodeNode");
  const field =
    action === "activate" ? "discountCodeActivate" : "discountCodeDeactivate";
  const operation =
    action === "activate"
      ? "CommerceOpsActivateDiscount"
      : "CommerceOpsDeactivateDiscount";
  const data = await callShopifyGraphql<
    Record<string, { codeDiscountNode: { id: string } | null; userErrors: UserError[] }>
  >({
    ...context,
    operationName: operation,
    retryTransport: false,
    query: `#graphql
      mutation ${operation}($id: ID!) {
        ${field}(id: $id) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }
    `,
    variables: { id },
  });
  const result = data[field]!;
  assertNoGraphqlUserErrors(result.userErrors, `Failed to ${action} the discount.`);
  return { id: result.codeDiscountNode?.id || id };
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw createApiErrorFromMessage("Invalid discount date.", 400);
  }
  return date.toISOString();
}
