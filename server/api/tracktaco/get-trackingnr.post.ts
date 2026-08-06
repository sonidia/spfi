import { createError, defineEventHandler, readBody } from "h3";
import type {
  TrackingNumberProxyRequest,
  TrackingNumberRequest,
  TrackingNumberResponse,
} from "~~/types/tracking";
import { resolvePublicHttpsEndpoint } from "../../utils/publicHttpsEndpoint";

type TrackingNumberProxyBody = Partial<TrackingNumberRequest> & {
  provider?: Partial<TrackingNumberProxyRequest["provider"]>;
};

const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_API_KEY_LENGTH = 4_096;

interface TracktacoError {
  statusCode?: number;
  status?: number;
  message?: string;
  statusMessage?: string;
  response?: {
    status?: number;
  };
  data?: {
    message?: string;
    statusMessage?: string;
  };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<TrackingNumberProxyBody>(event)) || {};
  const apiKey = String(body.provider?.apiKey || "").trim();
  const baseUrl = String(body.provider?.baseUrl || "").trim();

  if (!baseUrl || !apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tracking provider is not configured.",
      message: "Add the Tracktaco endpoint and API key in Settings.",
    });
  }

  if (
    baseUrl.length > MAX_ENDPOINT_LENGTH ||
    apiKey.length > MAX_API_KEY_LENGTH
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tracking provider configuration is invalid.",
    });
  }

  let endpoint: string;
  try {
    endpoint = await resolvePublicHttpsEndpoint(baseUrl);
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tracking provider URL is invalid.",
      message:
        error instanceof Error
          ? error.message
          : "The tracking API endpoint is invalid.",
    });
  }

  const request = normalizeTrackingRequest(body);

  try {
    const response = await $fetch<Record<string, unknown>>(endpoint, {
      method: "POST",
      timeout: 15_000,
      redirect: "error",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: request,
    });
    const trackingNr = String(response.trackingNr || "").trim();

    if (!trackingNr) {
      throw createError({
        statusCode: 502,
        statusMessage: "Invalid tracking provider response.",
        message: "The tracking provider returned an empty tracking number.",
      });
    }

    return { trackingNr } satisfies TrackingNumberResponse;
  } catch (error) {
    const candidate = error as TracktacoError;
    const statusCode = normalizeStatusCode(
      candidate.statusCode ||
        candidate.status ||
        candidate.response?.status ||
        502,
    );
    const message =
      candidate.data?.message ||
      candidate.data?.statusMessage ||
      candidate.message ||
      candidate.statusMessage ||
      "Failed to request a tracking number.";

    console.error("[Tracktaco Proxy Error]", message);
    throw createError({
      statusCode,
      statusMessage: "Failed to request a tracking number.",
      message,
    });
  }
});

function normalizeTrackingRequest(
  body: Partial<TrackingNumberRequest>,
): TrackingNumberRequest {
  const state = String(body.state || "")
    .trim()
    .toUpperCase();
  const carrier = String(body.carrier || "")
    .trim()
    .toLowerCase();
  const from = Number(body.from);
  const to = Number(body.to);

  if (
    !/^[A-Z0-9-]{2,12}$/.test(state) ||
    !/^[a-z0-9-]{2,32}$/.test(carrier) ||
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    from <= 0 ||
    to <= from
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid tracking number request.",
    });
  }

  return { state, carrier, from, to };
}

function normalizeStatusCode(statusCode: number) {
  return statusCode >= 400 && statusCode <= 599 ? statusCode : 502;
}
