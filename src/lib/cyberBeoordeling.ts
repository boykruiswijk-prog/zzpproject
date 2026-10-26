export function cyberBeoordelingFout(notitie: string): string | null {
  return notitie.trim().length < 10 || notitie.length > 1000
    ? "Voeg bij de beoordeling een toelichting van 10 tot 1.000 tekens toe."
    : null;
}

/** Preserve the server's meaningful error rather than the SDK's generic HTTP message. */
export async function cyberFunctieFout(error: unknown, data?: { error?: string } | null): Promise<Error> {
  const context = (error as { context?: unknown } | null)?.context;
  const body = context instanceof Response ? await context.clone().json().catch(() => null) : data;
  return new Error(body?.error ?? (error as { message?: string } | null)?.message ?? "Cyberbewerking mislukt.");
}