import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

  try {
    const response = await $fetch<any>(config.tracktacoBaseUrl, {
      method: "POST",
      headers: {
        "x-api-key": config.tracktacoApiKey,
        "Content-Type": "application/json",
      },
      body: body,
    });

    return response;
  } catch (err: any) {
    console.error("[Tracktaco Proxy Error]", err.message);
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: err.message || "Failed to fetch from Tracktaco",
    });
  }
});
