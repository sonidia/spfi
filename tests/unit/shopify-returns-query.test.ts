import { describe, expect, it } from "vitest";
import {
  RETURN_LINE_ITEMS_QUERY,
  RETURN_ORDERS_QUERY,
} from "~~/server/utils/shopify-returns";

describe("Shopify returns queries", () => {
  it("keeps the order scan separate from the return line-item connection", () => {
    expect(RETURN_ORDERS_QUERY).toContain(
      "returns(first: $returnsFirst, reverse: true)",
    );
    expect(RETURN_ORDERS_QUERY).not.toContain("returnLineItems(");
    expect(RETURN_LINE_ITEMS_QUERY).toContain("return(id: $id)");
    expect(RETURN_LINE_ITEMS_QUERY).toContain(
      "returnLineItems(first: $first, after: $after)",
    );
  });
});
