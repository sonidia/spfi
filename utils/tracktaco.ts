export const TRACKTACO_V2_BASE_URL = "https://v2.tracktaco.com";
export const TRACKTACO_V2_SEARCH_URL = `${TRACKTACO_V2_BASE_URL}/v2/tns/search`;
export const TRACKTACO_V2_REVEAL_URL = `${TRACKTACO_V2_BASE_URL}/v2/tns/reveal`;
export const TRACKTACO_V2_DOCS_URL = `${TRACKTACO_V2_BASE_URL}/v2/docs.md`;

export const TRACKTACO_CARRIER_NAMES = {
  fedex: "FedEx",
  ups: "UPS",
  dhl: "DHL",
} as const;

export const TRACKTACO_TRACKING_URLS = {
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  ups: "https://www.ups.com/track?tracknum=",
  dhl: "https://www.dhl.com/global-en/home/tracking.html?tracking-id=",
} as const;
