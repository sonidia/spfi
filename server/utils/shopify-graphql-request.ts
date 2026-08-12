import { createError } from "h3";

const MAX_QUERY_LENGTH = 50_000;
const MAX_VARIABLES_LENGTH = 50_000;
const MAX_QUERY_DEPTH = 30;
const OPERATION_NAME_PATTERN = /^[_A-Za-z][_0-9A-Za-z]{0,127}$/;

export interface ValidatedShopifyGraphqlRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export function validateShopifyGraphqlRequest(input: {
  query?: unknown;
  variables?: unknown;
  operationName?: unknown;
}): ValidatedShopifyGraphqlRequest {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) {
    throw requestError("A GraphQL query is required.", 400);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw requestError("The GraphQL query is too large.", 413);
  }

  const structuralQuery = maskGraphqlIgnoredContent(query);
  if (/\b(?:mutation|subscription)\b/i.test(structuralQuery)) {
    throw requestError(
      "The generic GraphQL endpoint only accepts read-only queries.",
      400,
    );
  }
  if (
    /\b__(?:schema|type|field|directive|enumValue|inputValue)\b/.test(structuralQuery)
  ) {
    throw requestError(
      "GraphQL schema introspection is not available through this endpoint.",
      400,
    );
  }
  if (getMaximumDepth(structuralQuery) > MAX_QUERY_DEPTH) {
    throw requestError("The GraphQL query is nested too deeply.", 400);
  }

  const operationName = normalizeOperationName(input.operationName);
  const operationCount = structuralQuery.match(/\bquery\b/g)?.length || 0;
  if (operationCount > 1 && !operationName) {
    throw requestError(
      "operationName is required when a document contains multiple queries.",
      400,
    );
  }

  const variables = normalizeVariables(input.variables);
  return {
    query,
    ...(variables ? { variables } : {}),
    ...(operationName ? { operationName } : {}),
  };
}

function normalizeOperationName(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const operationName = String(value).trim();
  if (!OPERATION_NAME_PATTERN.test(operationName)) {
    throw requestError("Invalid GraphQL operationName.", 400);
  }
  return operationName;
}

function normalizeVariables(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw requestError("GraphQL variables must be an object.", 400);
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw requestError("GraphQL variables must be serializable.", 400);
  }
  if (serialized.length > MAX_VARIABLES_LENGTH) {
    throw requestError("GraphQL variables are too large.", 413);
  }
  return value as Record<string, unknown>;
}

function requestError(message: string, statusCode: number) {
  return createError({ statusCode, statusMessage: message });
}

function getMaximumDepth(query: string) {
  let depth = 0;
  let maximum = 0;
  for (const character of query) {
    if (character === "{") maximum = Math.max(maximum, ++depth);
    if (character === "}") depth = Math.max(0, depth - 1);
  }
  return maximum;
}

function maskGraphqlIgnoredContent(query: string) {
  let output = "";
  let index = 0;

  while (index < query.length) {
    if (query[index] === "#") {
      while (index < query.length && query[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (query.startsWith('"""', index)) {
      output += "   ";
      index += 3;
      while (index < query.length && !query.startsWith('"""', index)) {
        output += query[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < query.length) {
        output += "   ";
        index += 3;
      }
      continue;
    }

    if (query[index] === '"') {
      output += " ";
      index += 1;
      while (index < query.length) {
        const character = query[index];
        output += character === "\n" ? "\n" : " ";
        index += 1;
        if (character === "\\" && index < query.length) {
          output += " ";
          index += 1;
        } else if (character === '"') {
          break;
        }
      }
      continue;
    }

    output += query[index];
    index += 1;
  }

  return output;
}
