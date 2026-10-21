/** Retired migration endpoints must never contact the former WordPress origin. */
export function legacyImportStop(req: Request, headers: Record<string, string>): Response | null {
  if (req.method === "OPTIONS") return null;
  return new Response(JSON.stringify({ error: "legacy_import_disabled", message: "De oude WordPress-import is uitgeschakeld." }), {
    status: 410, headers: { ...headers, "Content-Type": "application/json" },
  });
}