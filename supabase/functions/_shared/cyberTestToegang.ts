/** Service identity only, never internal-secret or an unverified role claim. */
export function isServiceTestRequest(req: Request, explicitTest: boolean): boolean {
  if (!explicitTest) return false;
  const runtime = (globalThis as unknown as { Deno?: { env: { get: (name: string) => string | undefined } } }).Deno;
  const key = runtime?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return false;
  return key.startsWith("sb_secret_")
    ? req.headers.get("apikey") === key && !req.headers.get("Authorization")
    : req.headers.get("Authorization") === `Bearer ${key}`;
}