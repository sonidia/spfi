import assert from "node:assert/strict";
import test from "node:test";
import { buildTlsCertificateSnapshot } from "../server/utils/tls-certificate.ts";

const NOW = new Date("2026-08-12T00:00:00Z").getTime();

test("TLS certificate verdict requires chain and hostname authorization", () => {
  const certificate = {
    valid_from: "Aug 01 00:00:00 2026 GMT",
    valid_to: "Sep 01 00:00:00 2026 GMT",
  };

  assert.equal(
    buildTlsCertificateSnapshot(certificate, { authorized: true }, NOW).ok,
    true,
  );
  assert.deepEqual(
    buildTlsCertificateSnapshot(
      certificate,
      { authorized: false, authorizationError: "HOSTNAME_MISMATCH" },
      NOW,
    ),
    {
      ok: false,
      validFrom: certificate.valid_from,
      validTo: certificate.valid_to,
      subject: undefined,
      issuer: undefined,
      fingerprint: undefined,
      daysRemaining: 20,
      error: "HOSTNAME_MISMATCH",
    },
  );
});

test("TLS certificate verdict rejects expired and not-yet-valid dates", () => {
  assert.equal(
    buildTlsCertificateSnapshot(
      {
        valid_from: "Aug 13 00:00:00 2026 GMT",
        valid_to: "Sep 01 00:00:00 2026 GMT",
      },
      { authorized: true },
      NOW,
    ).ok,
    false,
  );
  assert.equal(
    buildTlsCertificateSnapshot(
      {
        valid_from: "Jul 01 00:00:00 2026 GMT",
        valid_to: "Aug 11 00:00:00 2026 GMT",
      },
      { authorized: true },
      NOW,
    ).ok,
    false,
  );
});
