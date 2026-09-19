// Gedeelde anti-spam bescherming voor publieke formulieren.
// Drie lagen:
//  1. honeypot  — onzichtbaar veld dat alleen bots invullen
//  2. tijdslot  — een mens doet er langer dan MIN_FILL_MS over
//  3. throttle  — maximaal N inzendingen per IP per tijdvak (tabel form_rate_limit)
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.0";

export const MIN_FILL_MS = 2000;

/** Limieten per formuliersoort: max aantal inzendingen per IP per tijdvak. */
const LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  default: { max: 5, windowMinutes: 10 },
  newsletter: { max: 3, windowMinutes: 60 },
  bav: { max: 3, windowMinutes: 60 },
  screening: { max: 3, windowMinutes: 60 },
};

/** Totaalplafond per IP over alle formulieren heen. */
const GLOBAL_LIMIT = { max: 15, windowMinutes: 60 };

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "onbekend";
}

export interface GuardInput {
  /** Waarde van het honeypot-veld uit de body (moet leeg zijn). */
  hp?: unknown;
  /** Milliseconden tussen openen en versturen van het formulier. */
  ms?: unknown;
  /** Soort formulier, bepaalt de limiet. */
  kind: string;
}

export interface GuardResult {
  ok: boolean;
  status?: number;
  error?: string;
  reason?: string;
}

/**
 * Controleert honeypot, invultijd en IP-throttle. Registreert de poging
 * wanneer alles klopt, zodat opeenvolgende aanvragen meetellen.
 * Faalt nooit open op de throttle: bij een databasefout wordt doorgelaten
 * (beschikbaarheid boven spambescherming), maar dat wordt gelogd.
 */
export async function guardPublicSubmission(
  req: Request,
  supabase: SupabaseClient,
  input: GuardInput,
): Promise<GuardResult> {
  // 1. Honeypot
  if (typeof input.hp === "string" && input.hp.trim().length > 0) {
    console.warn(`[antiSpam] honeypot gevuld (${input.kind}) — geweigerd`);
    return { ok: false, status: 400, error: "Aanvraag geweigerd.", reason: "honeypot" };
  }

  // 2. Te snel ingevuld
  const ms = typeof input.ms === "number" ? input.ms : Number(input.ms);
  if (Number.isFinite(ms) && ms >= 0 && ms < MIN_FILL_MS) {
    console.warn(`[antiSpam] te snel verstuurd (${input.kind}, ${ms}ms) — geweigerd`);
    return {
      ok: false,
      status: 429,
      error: "Het formulier werd te snel verstuurd. Probeer het opnieuw.",
      reason: "too_fast",
    };
  }

  // 3. IP-throttle
  const ip = clientIp(req);
  const limit = LIMITS[input.kind] ?? LIMITS.default;
  try {
    const sinceKind = new Date(Date.now() - limit.windowMinutes * 60_000).toISOString();
    const { count: kindCount } = await supabase
      .from("form_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("kind", input.kind)
      .gte("created_at", sinceKind);

    if ((kindCount ?? 0) >= limit.max) {
      console.warn(`[antiSpam] IP-limiet bereikt (${input.kind}, ${ip})`);
      return {
        ok: false,
        status: 429,
        error: "Je hebt kort achter elkaar meerdere aanvragen verstuurd. Probeer het later opnieuw of bel ons.",
        reason: "rate_limited",
      };
    }

    const sinceGlobal = new Date(Date.now() - GLOBAL_LIMIT.windowMinutes * 60_000).toISOString();
    const { count: totalCount } = await supabase
      .from("form_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", sinceGlobal);

    if ((totalCount ?? 0) >= GLOBAL_LIMIT.max) {
      console.warn(`[antiSpam] globale IP-limiet bereikt (${ip})`);
      return {
        ok: false,
        status: 429,
        error: "Te veel aanvragen vanaf dit netwerk. Probeer het later opnieuw of bel ons.",
        reason: "rate_limited_global",
      };
    }

    await supabase.from("form_rate_limit").insert({ ip, kind: input.kind });
  } catch (err) {
    console.error("[antiSpam] throttle-check mislukt, aanvraag doorgelaten:", err);
  }

  return { ok: true };
}
