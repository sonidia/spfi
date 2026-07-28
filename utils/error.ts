import type { AppErrorLike } from "~~/types/shopify";

export function getAppErrorMessage(error: unknown, fallback: string) {
  const candidate = error as AppErrorLike;
  const statusMessage = candidate.data?.statusMessage;
  const dataMessage = candidate.data?.message;
  const message = candidate.message;

  if (typeof statusMessage === "string" && statusMessage) {
    return statusMessage;
  }

  if (typeof dataMessage === "string" && dataMessage) {
    return dataMessage;
  }

  if (typeof message === "string" && message) {
    return message;
  }

  return error instanceof Error ? error.message : fallback;
}
