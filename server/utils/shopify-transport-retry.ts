import { maskGraphqlIgnoredContent } from "./graphql-document.ts";

const GRAPHQL_WRITE_OPERATION_PATTERN = /\b(?:mutation|subscription)\b/;

export function resolveShopifyRestTransportRetry(
  method: string,
  retryTransport?: boolean,
): boolean {
  if (retryTransport !== undefined) return retryTransport;

  return method.toUpperCase() === "GET";
}

export function resolveShopifyGraphqlTransportRetry(
  document: string,
  retryTransport?: boolean,
): boolean {
  if (retryTransport !== undefined) return retryTransport;

  const structuralDocument = maskGraphqlIgnoredContent(document).trim();

  return (
    structuralDocument.length > 0 &&
    !GRAPHQL_WRITE_OPERATION_PATTERN.test(structuralDocument)
  );
}
