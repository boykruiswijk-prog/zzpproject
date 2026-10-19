import { isNlTelefoon, normaliseerNlTelefoon } from "../../supabase/functions/_shared/telefoon";

/** Event waarmee het snelle-startblok het bestaande aanvraagformulier opent. */
export const SNELLE_START_EVENT = "zp:snelle-start";
export const SNELLE_START_PAKKET = "maandelijks" as const;

export interface SnelleStartGegevens { email: string; telefoon: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Controleert de invoer; geeft opgeschoonde gegevens of een foutmelding in gewone taal. */
export function controleerSnelleStart(email: string, telefoon: string): { ok: true; gegevens: SnelleStartGegevens } | { ok: false; fout: string } {
  const e = (email ?? "").trim();
  if (!EMAIL.test(e)) return { ok: false, fout: "Vul een geldig e-mailadres in." };
  if (!isNlTelefoon(telefoon ?? "")) return { ok: false, fout: "Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678." };
  return { ok: true, gegevens: { email: e, telefoon: normaliseerNlTelefoon(telefoon) } };
}

export function startAanvraag(g: SnelleStartGegevens) {
  window.dispatchEvent(new CustomEvent<SnelleStartGegevens>(SNELLE_START_EVENT, { detail: g }));
}
