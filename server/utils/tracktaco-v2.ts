import type {
  TrackingCarrier,
  TrackingDateRange,
  TrackingDestination,
  TrackingNumberRequest,
} from "~~/types/tracking";

const TRACKTACO_CARRIERS = new Set<TrackingCarrier>(["fedex", "ups", "dhl"]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CITY_LENGTH = 120;

export interface TracktacoSearchCandidate {
  tnId: string;
  carrier: TrackingCarrier;
  service?: string;
}

export interface TracktacoSearchResponse {
  searches?: Array<{
    results?: Array<{
      tn_id?: unknown;
      carrier?: unknown;
      service?: unknown;
    }>;
    error?: { code?: unknown; message?: unknown };
  }>;
}

export interface TracktacoRevealResponse {
  results?: Array<{
    tn_id?: unknown;
    outcome?: unknown;
    tracking_number?: unknown;
    carrier?: unknown;
    service?: unknown;
    error?: { code?: unknown; message?: unknown };
  }>;
  credits_remaining?: unknown;
}

export function normalizeTrackingNumberRequest(
  value: Partial<TrackingNumberRequest>,
): TrackingNumberRequest {
  const carrier = String(value.carrier || "")
    .trim()
    .toLowerCase() as TrackingCarrier;
  if (!TRACKTACO_CARRIERS.has(carrier)) {
    throw new Error("Tracking carrier must be fedex, ups, or dhl.");
  }

  const destination = normalizeDestination(value.destination);
  const shippedBetween = normalizeDateRange(value.shippedBetween);

  return { carrier, destination, shippedBetween };
}

export function buildTracktacoSearchBody(request: TrackingNumberRequest) {
  const filter = {
    carrier: [request.carrier],
    dest: request.destination,
    shipped_between: {
      from: request.shippedBetween.from,
      to: request.shippedBetween.to,
    },
    status: ["transit"],
    signature_required: true,
    photo_confirmed: true,
  };
  const searches = [{ filter, page_size: 10 }];

  if (request.destination.city) {
    const { city: _city, ...broaderDestination } = request.destination;
    if (broaderDestination.country || broaderDestination.state) {
      searches.push({
        filter: { ...filter, dest: broaderDestination },
        page_size: 10,
      });
    }
  }

  return { searches };
}

export function collectTracktacoCandidates(response: TracktacoSearchResponse) {
  const candidates: TracktacoSearchCandidate[] = [];
  const seen = new Set<string>();

  for (const search of response.searches || []) {
    for (const result of search.results || []) {
      const tnId = String(result.tn_id || "").trim();
      const carrier = String(result.carrier || "")
        .trim()
        .toLowerCase() as TrackingCarrier;
      if (!tnId || seen.has(tnId) || !TRACKTACO_CARRIERS.has(carrier)) continue;
      seen.add(tnId);
      candidates.push({
        tnId,
        carrier,
        service: String(result.service || "").trim() || undefined,
      });
    }
  }

  return candidates;
}

export function getTracktacoSearchError(response: TracktacoSearchResponse) {
  for (const search of response.searches || []) {
    const message = String(search.error?.message || "").trim();
    if (message) return message;
  }
  return "";
}

export function parseTracktacoReveal(response: TracktacoRevealResponse, tnId: string) {
  const result = (response.results || []).find(
    (entry) => String(entry.tn_id || "") === tnId,
  );
  const outcome = String(result?.outcome || "internal").trim();
  const trackingNumber = String(result?.tracking_number || "").trim();
  const carrier = String(result?.carrier || "")
    .trim()
    .toLowerCase() as TrackingCarrier;
  const creditsRemaining = Number(response.credits_remaining);

  return {
    outcome,
    trackingNumber,
    carrier: TRACKTACO_CARRIERS.has(carrier) ? carrier : undefined,
    service: String(result?.service || "").trim() || undefined,
    errorCode: String(result?.error?.code || "").trim(),
    errorMessage: String(result?.error?.message || "").trim(),
    creditsRemaining: Number.isSafeInteger(creditsRemaining)
      ? creditsRemaining
      : undefined,
  };
}

function normalizeDestination(value?: Partial<TrackingDestination>) {
  const country = String(value?.country || "")
    .trim()
    .toUpperCase();
  const state = String(value?.state || "")
    .trim()
    .toUpperCase();
  const city = String(value?.city || "").trim();

  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw new Error("Tracking destination country must be an ISO alpha-2 code.");
  }
  if (state && !/^[A-Z0-9-]{1,12}$/.test(state)) {
    throw new Error("Tracking destination state is invalid.");
  }
  if (city.length > MAX_CITY_LENGTH || /[\u0000-\u001f\u007f]/.test(city)) {
    throw new Error("Tracking destination city is invalid.");
  }
  if (!country && !state && !city) {
    throw new Error("Tracking destination is required.");
  }

  return {
    ...(country ? { country } : {}),
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
  };
}

function normalizeDateRange(value?: Partial<TrackingDateRange>) {
  const from = String(value?.from || "").trim();
  const to = String(value?.to || "").trim();
  if (
    !ISO_DATE_PATTERN.test(from) ||
    !ISO_DATE_PATTERN.test(to) ||
    !isIsoDate(from) ||
    !isIsoDate(to) ||
    from > to
  ) {
    throw new Error("Tracking shipment date range is invalid.");
  }
  return { from, to };
}

function isIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}
