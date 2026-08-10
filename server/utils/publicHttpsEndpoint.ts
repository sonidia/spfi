import { PublicUrlError, resolvePublicUrl } from "./public-outbound-url";

export async function resolvePublicHttpsEndpoint(value: string) {
  try {
    const { url } = await resolvePublicUrl(value);
    url.hash = "";
    return url.toString();
  } catch (error) {
    if (error instanceof PublicUrlError) {
      throw new Error(`Invalid tracking API endpoint: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}
