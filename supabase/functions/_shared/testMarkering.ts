// Beveiligingscheck 2-11: een record wordt nooit meer als test gemarkeerd op basis van de Origin-
// of Referer-header (die kan elke bezoeker zelf zetten). Alleen een intern testadres (@zpzaken.nl)
// of een niet-productie APP_ENV van de functie zelf maakt een record tot test.
// Mailbeperking (createMailGate) blijft wel origin-gebaseerd: een vervalste header kan daar alleen mail onderdrukken.
import { isInternTestEmail } from "./nabellen.ts";

const NIET_PRODUCTIE = new Set(["preview", "development", "dev", "staging", "test"]);

export function appEnvNietProductie(): boolean {
  const g = globalThis as typeof globalThis & { Deno?: { env: { get(n: string): string | undefined } } };
  return NIET_PRODUCTIE.has((g.Deno?.env.get("APP_ENV") ?? "production").toLowerCase().trim());
}

export function isTestInzending(email: string | null | undefined): boolean {
  return isInternTestEmail(email) || appEnvNietProductie();
}
