import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnsafeHostnameReason,
  isPublicIpAddress,
  resolvePublicUrl,
} from "../server/utils/public-outbound-url.ts";
import { getAddressLines } from "../utils/address.ts";
import { getSafeExternalUrl } from "../utils/safe-url.ts";

test("outbound URL policy rejects internal and reserved address ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "198.51.100.10",
    "::1",
    "fc00::1",
    "fe80::1",
    "2002:7f00:1::",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }

  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicIpAddress("3000::1"), true);
  assert.match(getUnsafeHostnameReason("metadata.google.internal"), /internal/i);
  assert.match(getUnsafeHostnameReason("localhost"), /localhost/i);
  assert.match(
    getUnsafeHostnameReason(new URL("https://2130706433").hostname),
    /loopback/i,
  );
});

test("outbound URL policy rejects unsafe URL forms before connecting", async () => {
  await assert.rejects(resolvePublicUrl("http://example.com"), /HTTPS/i);
  await assert.rejects(
    resolvePublicUrl("https://example.com:8443"),
    /standard HTTPS port/i,
  );
  await assert.rejects(
    resolvePublicUrl("https://user:pass@example.com"),
    /credentials/i,
  );
  await assert.rejects(
    resolvePublicUrl("https://169.254.169.254/latest/meta-data"),
    /link-local/i,
  );
  await assert.rejects(
    resolvePublicUrl("https://example.com", {
      allowedHosts: ["httpbin.org"],
    }),
    /allowlisted/i,
  );
});

test("address formatting returns text lines instead of HTML", () => {
  const payload = '<img src=x onerror="alert(1)">';
  assert.deepEqual(
    getAddressLines({
      name: payload,
      address1: "1 Main Street",
      city: "Toronto",
      province_code: "ON",
      zip: "M1M 1M1",
      country: "Canada",
    }),
    [payload, "1 Main Street", "Toronto ON M1M 1M1", "Canada"],
  );
});

test("external links only accept HTTP and HTTPS URLs", () => {
  assert.equal(getSafeExternalUrl("javascript:alert(1)"), null);
  assert.equal(getSafeExternalUrl("data:text/html,payload"), null);
  assert.equal(
    getSafeExternalUrl("https://example.com/track?id=1"),
    "https://example.com/track?id=1",
  );
});
