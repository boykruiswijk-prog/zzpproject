export function beoordelingGeldig(body: Record<string, unknown>): boolean {
  return typeof body.id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.id)
    && typeof body.akkoord === "boolean" && typeof body.notitie === "string"
    && body.notitie.trim().length >= 10 && body.notitie.length <= 1000;
}

/** A certificate outage must not undo activation or cause confirmation to be sent. */
export async function cyberDocumentControle(start: () => Promise<Response>): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await start();
    const result = await response.json().catch(() => null);
    return response.ok && result?.success === true
      ? { ok: true }
      : { ok: false, error: result?.error ?? "Cybercertificaat kon niet worden gemaakt. Probeer later opnieuw." };
  } catch {
    return { ok: false, error: "Cybercertificaat kon niet worden bereikt. Probeer later opnieuw." };
  }
}