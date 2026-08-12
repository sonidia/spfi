import type { AppErrorLike } from "~~/types/shopify";

export function getAppErrorMessage(error: unknown, fallback: string) {
  const candidate = (error && typeof error === "object" ? error : {}) as AppErrorLike;
  const nestedMessage = candidate.data?.data?.error?.message;
  const standardMessage = candidate.data?.error?.message;
  const statusMessage = candidate.data?.statusMessage;
  const dataMessage = candidate.data?.message;
  const message = candidate.message;

  if (typeof nestedMessage === "string" && nestedMessage) {
    return nestedMessage;
  }

  if (typeof standardMessage === "string" && standardMessage) {
    return standardMessage;
  }

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
