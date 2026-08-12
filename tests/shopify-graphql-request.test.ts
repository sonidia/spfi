import assert from "node:assert/strict";
import test from "node:test";
import { validateShopifyGraphqlRequest } from "../server/utils/shopify-graphql-request.ts";

test("generic GraphQL validation accepts named read-only queries", () => {
  assert.deepEqual(
    validateShopifyGraphqlRequest({
      query: "query ShopName($id: ID!) { shop { name } }",
      variables: { id: "gid://shopify/Shop/1" },
      operationName: "ShopName",
    }),
    {
      query: "query ShopName($id: ID!) { shop { name } }",
      variables: { id: "gid://shopify/Shop/1" },
      operationName: "ShopName",
    },
  );
});

test("generic GraphQL validation rejects writes and introspection", () => {
  assert.throws(
    () =>
      validateShopifyGraphqlRequest({
        query:
          "mutation UpdateShop { shopUpdate(input: {}) { userErrors { message } } }",
      }),
    /read-only queries/i,
  );
  assert.throws(
    () => validateShopifyGraphqlRequest({ query: "{ __schema { types { name } } }" }),
    /introspection/i,
  );
});

test("GraphQL keywords inside strings and comments do not change operation type", () => {
  const request = validateShopifyGraphqlRequest({
    query:
      '# mutation ignored\n{ products(first: 1, query: "mutation") { nodes { id } } }',
  });
  assert.match(request.query, /products/);
});
