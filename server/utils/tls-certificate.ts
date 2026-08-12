export type CertificateFieldValue = string | string[] | undefined;

export interface CertificateDetails {
  valid_from?: string;
  valid_to?: string;
  subject?: Record<string, CertificateFieldValue>;
  issuer?: Record<string, CertificateFieldValue>;
  fingerprint256?: string;
}

export interface TlsCertificateSnapshot {
  ok: boolean;
  validFrom?: string;
  validTo?: string;
  subject?: string;
  issuer?: string;
  fingerprint?: string;
  daysRemaining?: number;
  error?: string;
}

export function buildTlsCertificateSnapshot(
  certificate: CertificateDetails,
  verification: {
    authorized: boolean;
    authorizationError?: unknown;
  },
  now = Date.now(),
): TlsCertificateSnapshot {
  const validFromTime = certificate.valid_from
    ? new Date(certificate.valid_from).getTime()
    : NaN;
  const validToTime = certificate.valid_to
    ? new Date(certificate.valid_to).getTime()
    : NaN;
  const hasValidDateRange =
    Number.isFinite(validFromTime) &&
    Number.isFinite(validToTime) &&
    validFromTime <= now &&
    validToTime > now;
  const daysRemaining = Number.isFinite(validToTime)
    ? Math.ceil((validToTime - now) / 86_400_000)
    : undefined;
  const verificationError = String(verification.authorizationError || "").trim();

  return {
    ok: verification.authorized && hasValidDateRange,
    validFrom: certificate.valid_from,
    validTo: certificate.valid_to,
    subject: formatCertificateName(certificate.subject),
    issuer: formatCertificateName(certificate.issuer),
    fingerprint: certificate.fingerprint256,
    daysRemaining,
    ...(!verification.authorized
      ? { error: verificationError || "TLS certificate trust verification failed." }
      : !hasValidDateRange
        ? { error: "TLS certificate is not currently within its validity period." }
        : {}),
  };
}

function formatCertificateName(
  value?: Record<string, CertificateFieldValue>,
): string | undefined {
  if (!value) return undefined;

  const parts = Object.values(value).flatMap((item) =>
    Array.isArray(item) ? item : item ? [item] : [],
  );
  return parts.length ? parts.join(", ") : undefined;
}
