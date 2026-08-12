import { createError } from "h3";

export type ApiErrorDetails = Record<string, unknown> | unknown[];

export interface StandardApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    status?: number;
    details?: ApiErrorDetails;
  };
}

export function buildStandardApiErrorEnvelope(
  message: string,
  status?: number,
  code?: string,
  details?: ApiErrorDetails,
): StandardApiError {
  return {
    success: false,
    error: {
      message,
      ...(code ? { code } : {}),
      ...(status ? { status } : {}),
      ...(details ? { details } : {}),
    },
  };
}

export function createStandardApiErrorFromMessage(
  message: string,
  status = 500,
  details?: ApiErrorDetails,
): ReturnType<typeof createError> {
  return createError({
    statusCode: status,
    statusMessage: message,
    data: buildStandardApiErrorEnvelope(message, status, undefined, details),
  });
}
