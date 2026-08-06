import { createError, defineEventHandler, readBody } from "h3";
import type {
  TrackingNumberRequest,
  TrackingNumberResponse,
} from "~~/types/tracking";

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
  const config = useRuntimeConfig();
  const baseUrl = String(config.public.tracktacoBaseUrl || "").trim();
  const apiKey = String(config.tracktacoApiKey || "").trim();
  const body = (await readBody<Partial<TrackingNumberRequest>>(event)) || {};

  assertTrackingConfig(baseUrl, apiKey);
  const request = normalizeTrackingRequest(body);

  try {
    const response = await $fetch<Record<string, unknown>>(baseUrl, {
      method: "POST",
      timeout: 15_000,
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

function assertTrackingConfig(baseUrl: string, apiKey: string) {
  if (!baseUrl || !apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: "Tracking provider is not configured.",
      message:
        "NUXT_TRACKTACO_API_KEY and NUXT_PUBLIC_TRACKTACO_BASE_URL are required.",
    });
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Tracking provider URL is invalid.",
    });
  }
}

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
