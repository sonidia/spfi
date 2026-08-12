import { createError, defineEventHandler, readBody } from "h3";
import type {
  TrackingNumberProxyRequest,
  TrackingNumberResponse,
} from "~~/types/tracking";
import { TRACKTACO_V2_REVEAL_URL, TRACKTACO_V2_SEARCH_URL } from "~~/utils/tracktaco";
import {
  buildTracktacoSearchBody,
  collectTracktacoCandidates,
  getTracktacoSearchError,
  normalizeTrackingNumberRequest,
  parseTracktacoReveal,
  type TracktacoRevealResponse,
  type TracktacoSearchResponse,
} from "../../utils/tracktaco-v2";

type TrackingNumberProxyBody = Partial<TrackingNumberProxyRequest> & {
  provider?: Partial<TrackingNumberProxyRequest["provider"]>;
};

interface TracktacoErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
  message?: string;
  statusMessage?: string;
}

interface TracktacoFetchError {
  statusCode?: number;
  status?: number;
  message?: string;
  statusMessage?: string;
  data?: TracktacoErrorEnvelope;
  response?: { status?: number };
}

const MAX_API_KEY_LENGTH = 4_096;
const MAX_REVEAL_ATTEMPTS = 3;
const tracktacoFetch = $fetch as unknown as <T>(
  url: string,
  options: Record<string, unknown>,
) => Promise<T>;

export default defineEventHandler(async (event) => {
  const body = (await readBody<TrackingNumberProxyBody>(event)) || {};
  const apiKey = String(body.provider?.apiKey || "").trim();

  if (!apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tracktaco v2 is not configured.",
      message: "Add a Tracktaco v2 API key in Settings.",
    });
  }
  if (apiKey.length > MAX_API_KEY_LENGTH || /[\r\n]/.test(apiKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tracktaco API key is invalid.",
    });
  }

  let request;
  try {
    request = normalizeTrackingNumberRequest(body);
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid tracking number request.",
      message: error instanceof Error ? error.message : undefined,
    });
  }

  const headers = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  const searchResponse = await callTracktaco<TracktacoSearchResponse>(
    TRACKTACO_V2_SEARCH_URL,
    headers,
    buildTracktacoSearchBody(request),
  );
  if (!Array.isArray(searchResponse.searches)) {
    throw createError({
      statusCode: 502,
      statusMessage: "Invalid Tracktaco search response.",
    });
  }
  const candidates = collectTracktacoCandidates(searchResponse);

  if (!candidates.length) {
    const searchError = getTracktacoSearchError(searchResponse);
    throw createError({
      statusCode: searchError ? 422 : 404,
      statusMessage: searchError
        ? "Tracktaco search was rejected."
        : "No matching tracking number found.",
      message:
        searchError ||
        "Tracktaco found no in-transit shipment for this destination and date range.",
    });
  }

  let lastRevealError = "";
  for (const candidate of candidates.slice(0, MAX_REVEAL_ATTEMPTS)) {
    const revealResponse = await callTracktaco<TracktacoRevealResponse>(
      TRACKTACO_V2_REVEAL_URL,
      headers,
      { tn_ids: [candidate.tnId] },
    );
    if (!Array.isArray(revealResponse.results)) {
      throw createError({
        statusCode: 502,
        statusMessage: "Invalid Tracktaco reveal response.",
      });
    }
    const reveal = parseTracktacoReveal(revealResponse, candidate.tnId);

    if (reveal.outcome === "revealed" && reveal.trackingNumber) {
      return {
        trackingNumber: reveal.trackingNumber,
        carrier: reveal.carrier || candidate.carrier,
        service: reveal.service || candidate.service,
        creditsRemaining: reveal.creditsRemaining,
      } satisfies TrackingNumberResponse;
    }

    if (reveal.outcome === "insufficient_credits") {
      throw createError({
        statusCode: 402,
        statusMessage: "Tracktaco credits are insufficient.",
        message: reveal.errorMessage || "Top up Tracktaco credits and try again.",
      });
    }

    lastRevealError =
      reveal.errorMessage ||
      (reveal.outcome === "already_revealed"
        ? "Another account revealed this tracking number first."
        : reveal.outcome === "not_found"
          ? "The tracking candidate is no longer available."
          : "Tracktaco could not reveal this tracking candidate.");
  }

  throw createError({
    statusCode: 409,
    statusMessage: "No tracking number could be revealed.",
    message: `${lastRevealError} Run the action again to search for fresh candidates.`,
  });
});

async function callTracktaco<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
) {
  try {
    return await tracktacoFetch<T>(url, {
      method: "POST",
      timeout: 15_000,
      redirect: "error",
      headers,
      body,
    });
  } catch (error) {
    const candidate = error as TracktacoFetchError;
    const statusCode = normalizeStatusCode(
      candidate.statusCode || candidate.status || candidate.response?.status || 502,
    );
    const providerError = candidate.data?.error;
    const message =
      providerError?.message ||
      candidate.data?.message ||
      candidate.data?.statusMessage ||
      candidate.message ||
      candidate.statusMessage ||
      "Tracktaco v2 request failed.";

    console.error("[Tracktaco v2]", {
      code: providerError?.code || "request_failed",
      requestId: providerError?.request_id,
      statusCode,
    });
    throw createError({
      statusCode,
      statusMessage: "Tracktaco v2 request failed.",
      message,
    });
  }
}

function normalizeStatusCode(statusCode: number) {
  return statusCode >= 400 && statusCode <= 599 ? statusCode : 502;
}
