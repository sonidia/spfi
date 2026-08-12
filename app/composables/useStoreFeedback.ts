import { useToastStore } from "~/stores/toast";

const RATE_LIMIT_PATTERN = /(rate limit|too many requests|throttl)/i;
const RECENT_TOAST_WINDOW_MS = 1400;
const recentToastAtByKey = new Map<string, number>();

function isRateLimitMessage(message: string) {
  return RATE_LIMIT_PATTERN.test(message);
}

function normalizeRateLimitMessage(message: string) {
  return message || "Rate limit reached. Please wait a moment and try again.";
}

function shouldSkipToast(type: string, message: string) {
  const now = Date.now();
  const key = `${type}:${message}`;
  const lastShownAt = recentToastAtByKey.get(key) || 0;
  if (now - lastShownAt < RECENT_TOAST_WINDOW_MS) return true;

  recentToastAtByKey.set(key, now);
  for (const [toastKey, shownAt] of recentToastAtByKey) {
    if (now - shownAt > RECENT_TOAST_WINDOW_MS) {
      recentToastAtByKey.delete(toastKey);
    }
  }
  return false;
}

export function useStoreFeedback() {
  const toast = useToastStore();

  function success(message: string, duration = 2600) {
    if (shouldSkipToast("success", message)) return;
    toast.success(message, duration);
  }

  function warning(message: string, duration = 4200) {
    if (shouldSkipToast("warning", message)) return;
    toast.warning(message, duration);
  }

  function error(message: string | null | undefined, fallback = "Request failed.") {
    const resolvedMessage = String(message || fallback).trim();
    if (isRateLimitMessage(resolvedMessage)) {
      warning(normalizeRateLimitMessage(resolvedMessage), 7000);
      return;
    }

    if (shouldSkipToast("error", resolvedMessage)) return;
    toast.error(resolvedMessage, 5200);
  }

  function requestResult({
    errorMessage,
    warningMessage,
    successMessage,
    fallbackError = "Request failed.",
  }: {
    errorMessage?: string | null;
    warningMessage?: string | null;
    successMessage: string;
    fallbackError?: string;
  }) {
    if (errorMessage) {
      error(errorMessage, fallbackError);
      return false;
    }

    if (warningMessage) {
      warning(warningMessage, 5600);
      return true;
    }

    success(successMessage);
    return true;
  }

  return {
    error,
    requestResult,
    success,
    warning,
  };
}
