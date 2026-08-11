import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnsafeHostnameReason,
  isPublicIpAddress,
  resolvePublicUrl,
} from "../server/utils/public-outbound-url.ts";
import { evaluateApiOriginPolicy } from "../server/utils/request-origin-policy.ts";
import {
  DEFAULT_API_RATE_LIMIT_PER_MINUTE,
  DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
  resolveRateLimit,
} from "../server/utils/rate-limit-policy.ts";
import { readRuntimeBoolean } from "../server/utils/runtime-config.ts";
import { buildContentSecurityPolicy } from "../server/utils/security-headers.ts";
import { GOOGLE_SHEET_VALUE_INPUT_OPTION } from "../server/utils/google-sheet-values.ts";
import {
  parsePublicProxyUrl,
  pinPublicProxyUrl,
} from "../server/utils/proxy-endpoint.ts";
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

test("proxy endpoints require SOCKS5H and can be pinned without DNS reuse", () => {
  assert.throws(() => parsePublicProxyUrl("http://8.8.8.8:1080"), /SOCKS5H/i);
  assert.throws(() => parsePublicProxyUrl("socks5h://8.8.8.8"), /port/i);

  const proxy = parsePublicProxyUrl("socks5h://user:pass@proxy.example:1080");
  assert.equal(
    pinPublicProxyUrl(proxy, { address: "8.8.8.8", family: 4 }),
    "socks5h://user:pass@8.8.8.8:1080",
  );
  assert.equal(
    pinPublicProxyUrl(proxy, {
      address: "2606:4700:4700::1111",
      family: 6,
    }),
    "socks5h://user:pass@[2606:4700:4700::1111]:1080",
  );
});

test("API origin policy rejects originless mutations and cross-site browsers", () => {
  assert.equal(
    evaluateApiOriginPolicy({ method: "POST", requireOrigin: true }).allowed,
    false,
  );
  assert.equal(
    evaluateApiOriginPolicy({
      method: "POST",
      fetchSite: "same-origin",
      requireOrigin: true,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateApiOriginPolicy({
      method: "GET",
      fetchSite: "cross-site",
    }).allowed,
    false,
  );
  assert.equal(
    evaluateApiOriginPolicy({
      method: "POST",
      origin: "https://ops.example.com",
      fetchSite: "cross-site",
      allowedOrigins: "https://ops.example.com",
    }).allowed,
    true,
  );
  assert.equal(
    evaluateApiOriginPolicy({
      method: "POST",
      origin: "https://spoofed.example",
      requestOrigin: "https://spoofed.example",
      allowHostFallback: false,
    }).allowed,
    false,
  );

  const sameOrigin = evaluateApiOriginPolicy({
    method: "POST",
    origin: "https://app.example.com",
    fetchSite: "same-origin",
    requestOrigin: "https://app.example.com",
  });
  assert.equal(sameOrigin.allowed, true);
  assert.equal(sameOrigin.responseOrigin, undefined);

  const spoofedSameOrigin = evaluateApiOriginPolicy({
    method: "POST",
    origin: "https://attacker.example",
    fetchSite: "same-origin",
    requestOrigin: "https://app.example.com",
  });
  assert.equal(spoofedSameOrigin.allowed, false);
  assert.equal(spoofedSameOrigin.responseOrigin, undefined);

  const configuredCrossOrigin = evaluateApiOriginPolicy({
    method: "POST",
    origin: "https://ops.example.com",
    fetchSite: "cross-site",
    allowedOrigins: "https://ops.example.com",
  });
  assert.equal(configuredCrossOrigin.responseOrigin, "https://ops.example.com");
});

test("security defaults block inline scripts and fail closed", () => {
  const policy = buildContentSecurityPolicy("test-nonce");
  assert.match(policy, /script-src 'self' 'nonce-test-nonce'/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.equal(GOOGLE_SHEET_VALUE_INPUT_OPTION, "RAW");
  assert.equal(
    resolveRateLimit(0, DEFAULT_API_RATE_LIMIT_PER_MINUTE),
    DEFAULT_API_RATE_LIMIT_PER_MINUTE,
  );
  assert.equal(
    resolveRateLimit("invalid", DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE),
    DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
  );
});

test("security runtime flags fail closed on malformed values", () => {
  assert.equal(readRuntimeBoolean("true"), true);
  assert.equal(readRuntimeBoolean("OFF", true), false);
  assert.equal(readRuntimeBoolean("unexpected"), false);
  assert.equal(readRuntimeBoolean("unexpected", true), true);
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
  assert.equal(getSafeExternalUrl("https://user:secret@example.com"), null);
  assert.equal(getSafeExternalUrl("data:text/html,payload"), null);
  assert.equal(
    getSafeExternalUrl("https://example.com/track?id=1"),
    "https://example.com/track?id=1",
  );
});
