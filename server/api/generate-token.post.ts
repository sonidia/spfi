export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { storeId, clientId, clientSecret } = body;

  if (!storeId || !clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing storeId, clientId, or clientSecret",
    });
  }

  const url = `https://${storeId}.myshopify.com/admin/oauth/access_token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

  try {
    const response = await $fetch(url, {
      method: "POST",
    });
    return response;
  } catch (error: any) {
    throw createError({
      statusCode: error?.response?.status || 500,
      statusMessage: error?.message || "Error generating access token",
    });
  }
});
