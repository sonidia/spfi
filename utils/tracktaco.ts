export const TRACKTACO_V2_BASE_URL = "https://v2.tracktaco.com";
export const TRACKTACO_V2_SEARCH_URL = `${TRACKTACO_V2_BASE_URL}/v2/tns/search`;
export const TRACKTACO_V2_REVEAL_URL = `${TRACKTACO_V2_BASE_URL}/v2/tns/reveal`;
export const TRACKTACO_V2_DOCS_URL = `${TRACKTACO_V2_BASE_URL}/v2/docs.md`;

export const TRACKTACO_CARRIER_NAMES = {
  fedex: "FedEx",
  ups: "UPS",
  dhl: "DHL",
} as const;

export const TRACKTACO_CARRIERS = Object.keys(TRACKTACO_CARRIER_NAMES) as Array<
  keyof typeof TRACKTACO_CARRIER_NAMES
>;

const TRACKING_URL_CONFIG = {
  fedex: {
    url: "https://www.fedex.com/fedextrack/",
    parameter: "trknbr",
  },
  ups: {
    url: "https://www.ups.com/track",
    parameter: "tracknum",
  },
  dhl: {
    url: "https://www.dhl.com/global-en/home/tracking.html",
    parameter: "tracking-id",
  },
} as const;

export function isTrackingCarrier(
  value: unknown,
): value is keyof typeof TRACKTACO_CARRIER_NAMES {
  return TRACKTACO_CARRIERS.includes(
    String(value || "")
      .trim()
      .toLowerCase() as keyof typeof TRACKTACO_CARRIER_NAMES,
  );
}

export function normalizeTrackingCarrier(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return isTrackingCarrier(normalized) ? normalized : "fedex";
}

export function findTrackingCarrierByCompany(value: unknown) {
  const company = String(value || "")
    .trim()
    .toLowerCase();
  return TRACKTACO_CARRIERS.find(
    (carrier) => TRACKTACO_CARRIER_NAMES[carrier].toLowerCase() === company,
  );
}

export function buildCarrierTrackingUrl(
  carrier: keyof typeof TRACKTACO_CARRIER_NAMES,
  trackingNumber: unknown,
) {
  const number = String(trackingNumber || "").trim();
  if (!number) return "";

  const config = TRACKING_URL_CONFIG[carrier];
  const url = new URL(config.url);
  url.searchParams.set(config.parameter, number);
  return url.toString();
}
