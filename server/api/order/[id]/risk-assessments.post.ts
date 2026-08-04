import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type {
  RiskAssessmentLevel,
  ShopifyOrderRiskAssessment,
  ShopifyRiskFact,
} from "~~/types/shopify-order";

const ORDER_RISK_ASSESSMENT_CREATE_MUTATION = `#graphql
  mutation OrderRiskAssessmentCreate($input: OrderRiskAssessmentCreateInput!) {
    orderRiskAssessmentCreate(orderRiskAssessmentInput: $input) {
      userErrors {
        field
        message
      }
      orderRiskAssessment {
        facts {
          description
          sentiment
        }
        provider {
          title
        }
        riskLevel
      }
    }
  }
`;

const RISK_LEVELS = new Set<RiskAssessmentLevel>([
  "HIGH",
  "MEDIUM",
  "LOW",
  "NONE",
  "PENDING",
]);

interface CreateRiskAssessmentBody {
  storeId?: string;
  token?: string;
  riskLevel?: RiskAssessmentLevel;
  facts?: ShopifyRiskFact[];
}

interface CreateRiskAssessmentData {
  orderRiskAssessmentCreate: {
    userErrors: Array<{ field?: string[] | null; message: string }>;
    orderRiskAssessment: ShopifyOrderRiskAssessment | null;
  };
}

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const body = (await readBody<CreateRiskAssessmentBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const riskLevel = String(body.riskLevel || "") as RiskAssessmentLevel;

  if (!id || !storeId || !token || !RISK_LEVELS.has(riskLevel)) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and a valid risk level are required.",
      400,
    );
  }

  const data = await callShopifyGraphql<CreateRiskAssessmentData>({
    event,
    storeId,
    token,
    query: ORDER_RISK_ASSESSMENT_CREATE_MUTATION,
    variables: {
      input: {
        orderId: toShopifyGid("Order", id),
        riskLevel,
        facts: Array.isArray(body.facts) ? body.facts : [],
      },
    },
    operationName: "OrderRiskAssessmentCreate",
  });

  const payload = data.orderRiskAssessmentCreate;
  assertNoGraphqlUserErrors(
    payload.userErrors,
    "Unable to create the order risk assessment.",
  );
  if (!payload.orderRiskAssessment) {
    throw createApiErrorFromMessage(
      "Shopify did not return the created risk assessment.",
      502,
    );
  }

  return { orderRiskAssessment: payload.orderRiskAssessment };
});
