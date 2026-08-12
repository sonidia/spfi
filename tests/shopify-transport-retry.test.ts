import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveShopifyGraphqlTransportRetry,
  resolveShopifyRestTransportRetry,
} from "../server/utils/shopify-transport-retry.ts";

test("REST transport retries default to read-only requests", () => {
  assert.equal(resolveShopifyRestTransportRetry("GET"), true);
  assert.equal(resolveShopifyRestTransportRetry("POST"), false);
  assert.equal(resolveShopifyRestTransportRetry("PUT"), false);
  assert.equal(resolveShopifyRestTransportRetry("DELETE"), false);
});

test("REST transport retry overrides remain explicit", () => {
  assert.equal(resolveShopifyRestTransportRetry("GET", false), false);
  assert.equal(resolveShopifyRestTransportRetry("POST", true), true);
});

test("GraphQL transport retries default to read-only documents", () => {
  assert.equal(
    resolveShopifyGraphqlTransportRetry(`
      # Fetch orders without replaying mutations.
      query Orders { orders(first: 10, query: "mutation") { nodes { id } } }
    `),
    true,
  );
  assert.equal(
    resolveShopifyGraphqlTransportRetry(`
      mutation CreateOrder { orderCreate(order: {}) { order { id } } }
    `),
    false,
  );
  assert.equal(
    resolveShopifyGraphqlTransportRetry(`
      query Orders { orders(first: 10) { nodes { id } } }
      mutation CreateOrder { orderCreate(order: {}) { order { id } } }
    `),
    false,
  );
  assert.equal(
    resolveShopifyGraphqlTransportRetry(
      "subscription OrderEvents { orderEvents { id } }",
    ),
    false,
  );
});

test("GraphQL transport retry overrides remain explicit", () => {
  const mutation =
    "mutation UpdateProduct { productUpdate(product: {}) { product { id } } }";

  assert.equal(resolveShopifyGraphqlTransportRetry(mutation, true), true);
  assert.equal(
    resolveShopifyGraphqlTransportRetry("query Shop { shop { id } }", false),
    false,
  );
});
