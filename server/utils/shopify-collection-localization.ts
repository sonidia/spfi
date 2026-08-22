import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import type {
  CollectionTranslationInput,
  CollectionTranslationResource,
} from "~~/types/shopify-collection";

interface CollectionLocalizationOptions {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}

export async function getCollectionTranslations(
  options: CollectionLocalizationOptions & { locale: unknown },
): Promise<CollectionTranslationResource> {
  const locale = normalizeLocale(options.locale);
  const variables = { resourceId: options.id, locale };
  const data = await callShopifyGraphql<
    {
      shopLocales: Array<{ locale: string }>;
      translatableResource: {
        resourceId: string;
        translatableContent: Array<{
          key: string;
          value: string | null;
          digest: string;
        }>;
        translations: Array<{
          key: string;
          value: string;
          outdated: boolean;
        }>;
      } | null;
    },
    typeof variables
  >({
    ...options,
    operationName: "CollectionTranslations",
    query: `
      query CollectionTranslations($resourceId: ID!, $locale: String!) {
        shopLocales { locale }
        translatableResource(resourceId: $resourceId) {
          resourceId
          translatableContent { key value digest }
          translations(locale: $locale) { key value outdated }
        }
      }
    `,
    variables,
  });
  assertLocaleEnabled(locale, data.shopLocales);
  if (!data.translatableResource) {
    throw createApiErrorFromMessage("Collection is not translatable.", 422);
  }
  const translations = new Map(
    data.translatableResource.translations.map((translation) => [
      translation.key,
      translation,
    ]),
  );
  return {
    resourceId: data.translatableResource.resourceId,
    locale,
    fields: data.translatableResource.translatableContent.map((field) => ({
      key: field.key,
      sourceValue: field.value,
      digest: field.digest,
      value: translations.get(field.key)?.value || null,
      outdated: translations.get(field.key)?.outdated || false,
    })),
  };
}

export async function saveCollectionTranslations(
  options: CollectionLocalizationOptions & {
    locale: unknown;
    fields: unknown;
  },
) {
  const locale = normalizeLocale(options.locale);
  const fields = normalizeTranslationInputs(options.fields);
  const current = await getCollectionTranslations({ ...options, locale });
  const currentFields = new Map(current.fields.map((field) => [field.key, field]));
  for (const field of fields) {
    const persisted = currentFields.get(field.key);
    if (!persisted) {
      throw createApiErrorFromMessage(
        `Translation key ${field.key} is not available on this collection.`,
        422,
      );
    }
    if (persisted.digest !== field.digest) {
      throw createApiErrorFromMessage(
        "Collection content changed after translations were loaded. Refresh before saving.",
        409,
      );
    }
  }

  const registrations = fields.filter((field) => field.value !== "");
  const removals = fields.filter(
    (field) => field.value === "" && currentFields.get(field.key)?.value !== null,
  );
  if (registrations.length) {
    await registerCollectionTranslations(options, locale, registrations);
  }
  if (removals.length) {
    await removeCollectionTranslations(
      options,
      locale,
      removals.map((field) => field.key),
    );
  }
  return getCollectionTranslations({ ...options, locale });
}

async function registerCollectionTranslations(
  options: CollectionLocalizationOptions,
  locale: string,
  fields: CollectionTranslationInput[],
) {
  const variables = {
    resourceId: options.id,
    translations: fields.map((field) => ({
      locale,
      key: field.key,
      value: field.value,
      translatableContentDigest: field.digest,
    })),
  };
  const data = await callShopifyGraphql<
    {
      translationsRegister: {
        userErrors: Array<{ field?: string[] | null; message: string; code?: string }>;
      };
    },
    typeof variables
  >({
    ...options,
    operationName: "SaveCollectionTranslations",
    retryTransport: false,
    query: `
      mutation SaveCollectionTranslations(
        $resourceId: ID!
        $translations: [TranslationInput!]!
      ) {
        translationsRegister(
          resourceId: $resourceId
          translations: $translations
        ) {
          userErrors { field message code }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.translationsRegister.userErrors,
    "Failed to save collection translations.",
  );
}

async function removeCollectionTranslations(
  options: CollectionLocalizationOptions,
  locale: string,
  translationKeys: string[],
) {
  const variables = {
    resourceId: options.id,
    locales: [locale],
    translationKeys,
  };
  const data = await callShopifyGraphql<
    {
      translationsRemove: {
        userErrors: Array<{ field?: string[] | null; message: string; code?: string }>;
      };
    },
    typeof variables
  >({
    ...options,
    operationName: "RemoveCollectionTranslations",
    retryTransport: false,
    query: `
      mutation RemoveCollectionTranslations(
        $resourceId: ID!
        $locales: [String!]!
        $translationKeys: [String!]!
      ) {
        translationsRemove(
          resourceId: $resourceId
          locales: $locales
          translationKeys: $translationKeys
        ) {
          userErrors { field message code }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.translationsRemove.userErrors,
    "Failed to remove collection translations.",
  );
}

function normalizeLocale(value: unknown) {
  const locale = String(value || "").trim();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale)) {
    throw createApiErrorFromMessage("A valid Shopify locale is required.", 400);
  }
  return locale;
}

function assertLocaleEnabled(locale: string, locales: Array<{ locale: string }>) {
  const normalized = locale.toLowerCase();
  if (!locales.some((candidate) => candidate.locale.toLowerCase() === normalized)) {
    throw createApiErrorFromMessage("Locale is not enabled for this store.", 422);
  }
}

function normalizeTranslationInputs(value: unknown): CollectionTranslationInput[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) {
    throw createApiErrorFromMessage(
      "Provide between 1 and 100 translation fields.",
      400,
    );
  }
  const seen = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw createApiErrorFromMessage("Invalid translation field.", 400);
    }
    const input = entry as Record<string, unknown>;
    const key = String(input.key || "").trim();
    const digest = String(input.digest || "").trim();
    const translation = String(input.value ?? "");
    if (!key || !digest || key.length > 255 || digest.length > 255) {
      throw createApiErrorFromMessage("Translation key and digest are required.", 400);
    }
    if (translation.length > 1_000_000) {
      throw createApiErrorFromMessage("Translation value is too long.", 400);
    }
    if (seen.has(key)) {
      throw createApiErrorFromMessage(`Duplicate translation key ${key}.`, 400);
    }
    seen.add(key);
    return { key, digest, value: translation };
  });
}
