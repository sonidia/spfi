import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import {
  buildProductOptionsCreateMutation,
  buildProductOptionUpdateMutation,
  type ProductOptionCreateOperation,
  type ProductOptionUpdateOperation,
} from "./shopify-product-option-input.ts";
import { isShopifyNumericId } from "./shopify-id";
import type { ShopifyNumericId, ShopifyProductOption } from "~~/types/shopify";
import type {
  ShopifyProductOptionCreateVariantStrategy,
  ShopifyProductOptionMutationInput,
  ShopifyProductOptionUpdateVariantStrategy,
  ShopifyProductOptionValueInput,
} from "~~/types/shopify-product";

interface ProductOptionNode {
  id: string;
  name: string;
  position: number;
  values: string[];
  linkedMetafield: { namespace: string; key: string } | null;
  optionValues: Array<{
    id: string;
    name: string;
    linkedMetafieldValue: string | null;
  }>;
}

interface ProductOptionMutationPayload {
  userErrors?: Array<{ field?: string[] | null; message: string; code?: string }>;
}

export async function updateShopifyProductOptions(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
  productOptions: ShopifyProductOptionMutationInput[];
  updateVariantStrategy?: ShopifyProductOptionUpdateVariantStrategy;
  createVariantStrategy?: ShopifyProductOptionCreateVariantStrategy;
}) {
  const currentOptions = await loadProductOptions(options);
  const currentById = new Map(
    currentOptions.map((option) => [legacyIdFromGid(option.id), option]),
  );
  const createOperations = options.productOptions
    .filter((option) => option.id === undefined)
    .map(toCreateOperation);

  if (currentOptions.length + createOperations.length > 3) {
    throw createApiErrorFromMessage(
      "A Shopify product can have no more than three options.",
      400,
    );
  }

  if (createOperations.length) {
    const mutation = buildProductOptionsCreateMutation(
      options.productId,
      createOperations,
      options.createVariantStrategy,
    );
    const data = await callShopifyGraphql<
      { productOptionsCreate: ProductOptionMutationPayload },
      typeof mutation.variables
    >({
      ...options,
      operationName: "CreateProductOptions",
      query: mutation.query,
      variables: mutation.variables,
      retryTransport: false,
    });
    assertNoGraphqlUserErrors(
      data.productOptionsCreate.userErrors,
      "Failed to create product options.",
    );
  }

  const updateOperations = options.productOptions
    .filter(
      (
        option,
      ): option is ShopifyProductOptionMutationInput & { id: ShopifyNumericId } =>
        option.id !== undefined,
    )
    .map((option) => {
      const current = currentById.get(String(option.id));
      if (!current) {
        throw createApiErrorFromMessage(
          `Product option ${String(option.id)} does not belong to this product.`,
          400,
        );
      }
      return toUpdateOperation(option, current);
    });

  if (updateOperations.length) {
    const mutation = buildProductOptionUpdateMutation(
      options.productId,
      updateOperations,
      options.updateVariantStrategy,
    );
    const data = await callShopifyGraphql<
      Record<string, ProductOptionMutationPayload>,
      typeof mutation.variables
    >({
      ...options,
      operationName: "UpdateProductOptions",
      query: mutation.query,
      variables: mutation.variables,
      retryTransport: false,
    });
    const userErrors = updateOperations.flatMap(
      (_, index) => data[`option${index}`]?.userErrors || [],
    );
    assertNoGraphqlUserErrors(userErrors, "Failed to update product options.");
  }

  return (await loadProductOptions(options)).map(mapProductOption);
}

async function loadProductOptions(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
}) {
  const data = await callShopifyGraphql<
    { product: { options: ProductOptionNode[] } | null },
    { id: string }
  >({
    ...options,
    operationName: "ProductOptions",
    query: `#graphql
      query ProductOptions($id: ID!) {
        product(id: $id) {
          options {
            id name position values
            linkedMetafield { namespace key }
            optionValues { id name linkedMetafieldValue }
          }
        }
      }
    `,
    variables: { id: `gid://shopify/Product/${String(options.productId)}` },
  });
  if (!data.product) {
    throw createApiErrorFromMessage("Shopify did not return the product.", 404);
  }
  return data.product.options;
}

function toCreateOperation(
  option: ShopifyProductOptionMutationInput,
): ProductOptionCreateOperation {
  const values = normalizeCreateValues(option);
  for (const value of values) {
    if (value.id !== undefined) {
      throw createApiErrorFromMessage(
        "New product option values must not include an id.",
        400,
      );
    }
    if (!value.name?.trim() && !value.linkedMetafieldValue?.trim()) {
      throw createApiErrorFromMessage(
        "Each new product option value requires a name or linked metafield value.",
        400,
      );
    }
  }
  if (!values.length) {
    throw createApiErrorFromMessage(
      `New option "${option.name}" requires at least one value.`,
      400,
    );
  }
  return {
    name: option.name,
    ...(option.position ? { position: option.position } : {}),
    values,
    ...(option.linkedMetafield ? { linkedMetafield: option.linkedMetafield } : {}),
  };
}

function toUpdateOperation(
  option: ShopifyProductOptionMutationInput & { id: ShopifyNumericId },
  current: ProductOptionNode,
): ProductOptionUpdateOperation {
  const operation: ProductOptionUpdateOperation = {
    option: {
      id: option.id,
      name: option.name,
      ...(option.position ? { position: option.position } : {}),
      ...(option.linkedMetafield ? { linkedMetafield: option.linkedMetafield } : {}),
    },
  };

  if (option.optionValues !== undefined) {
    const currentValueIds = new Set(
      current.optionValues.map((value) => legacyIdFromGid(value.id)),
    );
    operation.optionValuesToAdd = option.optionValues.filter(
      (value) => value.id === undefined,
    );
    operation.optionValuesToUpdate = option.optionValues.filter((value) => {
      if (value.id === undefined) return false;
      if (!currentValueIds.has(String(value.id))) {
        throw createApiErrorFromMessage(
          `Option value ${String(value.id)} does not belong to option ${String(option.id)}.`,
          400,
        );
      }
      return true;
    });
  } else if (option.values !== undefined) {
    const requestedNames = uniqueNames(option.values);
    const requestedKeys = new Set(requestedNames.map(normalizeNameKey));
    const existingKeys = new Set(
      current.optionValues.map((value) => normalizeNameKey(value.name)),
    );
    operation.optionValuesToAdd = requestedNames
      .filter((name) => !existingKeys.has(normalizeNameKey(name)))
      .map((name) => ({ name }));
    operation.optionValuesToDelete = current.optionValues
      .filter((value) => !requestedKeys.has(normalizeNameKey(value.name)))
      .map((value) => legacyIdFromGid(value.id));
  }

  if (option.optionValueIdsToDelete?.length) {
    const currentValueIds = new Set(
      current.optionValues.map((value) => legacyIdFromGid(value.id)),
    );
    for (const id of option.optionValueIdsToDelete) {
      if (!isShopifyNumericId(id) || !currentValueIds.has(String(id))) {
        throw createApiErrorFromMessage(
          `Option value ${String(id)} does not belong to option ${String(option.id)}.`,
          400,
        );
      }
    }
    operation.optionValuesToDelete = Array.from(
      new Set([
        ...(operation.optionValuesToDelete || []),
        ...option.optionValueIdsToDelete,
      ]),
    );
    const deletedIds = new Set(operation.optionValuesToDelete.map(String));
    operation.optionValuesToUpdate = operation.optionValuesToUpdate?.filter(
      (value) => value.id === undefined || !deletedIds.has(String(value.id)),
    );
  }
  return operation;
}

function normalizeCreateValues(
  option: ShopifyProductOptionMutationInput,
): ShopifyProductOptionValueInput[] {
  if (option.optionValues !== undefined) return option.optionValues;
  return uniqueNames(option.values || []).map((name) => ({ name }));
}

function uniqueNames(values: string[]) {
  return Array.from(
    new Map(
      values
        .map((value) => String(value).trim())
        .filter(Boolean)
        .map((value) => [normalizeNameKey(value), value] as const),
    ).values(),
  );
}

function normalizeNameKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function mapProductOption(option: ProductOptionNode): ShopifyProductOption {
  return {
    id: legacyIdFromGid(option.id),
    name: option.name,
    position: option.position,
    values: option.values,
    linkedMetafield: option.linkedMetafield,
    optionValues: option.optionValues.map((value) => ({
      id: legacyIdFromGid(value.id),
      name: value.name,
      linkedMetafieldValue: value.linkedMetafieldValue,
    })),
  };
}

function legacyIdFromGid(gid: string) {
  return gid.slice(gid.lastIndexOf("/") + 1);
}
