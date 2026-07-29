const CREDENTIAL_UNLOCK_WHITELIST = new Set([
  "/",
  "/setup",
  "/sheet",
  "/status",
]);

export function isCredentialRouteWhitelisted(path: string) {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  return CREDENTIAL_UNLOCK_WHITELIST.has(normalizedPath);
}
