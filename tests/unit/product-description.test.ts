import { describe, expect, it } from "vitest";
import {
  renderProductDescription,
  sanitizeProductDescriptionHtml,
} from "~~/utils/product-description";

describe("product description preview", () => {
  it("renders common Markdown blocks and inline formatting", () => {
    const html = renderProductDescription(
      "## Materials\n\nMade with **organic cotton**.\n\n- Soft\n- Durable",
    );

    expect(html).toContain("<h2>Materials</h2>");
    expect(html).toContain("Made with <strong>organic cotton</strong>.");
    expect(html).toContain("<ul><li>Soft</li><li>Durable</li></ul>");
  });

  it("keeps safe Shopify HTML while removing executable markup", () => {
    const html = sanitizeProductDescriptionHtml(
      '<h2>Details</h2><script>alert(1)</script><p onclick="alert(2)">Safe</p><a href="javascript:alert(3)">Bad</a><a href="https://example.com">Good</a>',
    );

    expect(html).toContain("<h2>Details</h2>");
    expect(html).toContain("<p>Safe</p>");
    expect(html).toContain("<a>Bad</a>");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
  });
});
