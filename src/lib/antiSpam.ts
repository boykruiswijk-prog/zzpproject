// Client-zijde helpers voor de anti-spam bescherming op publieke formulieren.
// Het echte werk (honeypot-check, invultijd, IP-limiet) gebeurt server-side in
// de edge function submit-public-form / _shared/antiSpam.ts.
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Naam van het onzichtbare veld. Bots vullen 'm, mensen zien 'm niet. */
export const HONEYPOT_NAME = "website_url";

export interface FormGuard {
  /** Huidige waarde van het honeypot-veld. */
  honeypot: string;
  /** Props voor het onzichtbare invoerveld. */
  honeypotProps: {
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    tabIndex: number;
    autoComplete: string;
    "aria-hidden": true;
  };
  /** Milliseconden sinds het formulier in beeld kwam. */
  elapsedMs: () => number;
}

export function useFormGuard(): FormGuard {
  const [honeypot, setHoneypot] = useState("");
  const startedAt = useRef<number>(Date.now());

  const elapsedMs = useCallback(() => Date.now() - startedAt.current, []);

  return {
    honeypot,
    honeypotProps: {
      name: HONEYPOT_NAME,
      value: honeypot,
      onChange: (e) => setHoneypot(e.target.value),
      tabIndex: -1,
      autoComplete: "off",
      "aria-hidden": true,
    },
    elapsedMs,
  };
}

export class PublicFormError extends Error {
  reason?: string;
  constructor(message: string, reason?: string) {
    super(message);
    this.reason = reason;
  }
}

type GuardedTable =
  | "leads"
  | "collective_signups"
  | "collective_newsletter"
  | "collective_suggestions";

/**
 * Verstuurt een publiek formulier via de beveiligde edge function.
 * Gooit een PublicFormError met een nette Nederlandse melding bij weigering.
 */
export async function submitPublicForm<T extends Record<string, unknown>>(
  table: GuardedTable,
  row: T,
  guard: { honeypot: string; elapsedMs: () => number },
): Promise<{ id: string | null }> {
  const { data, error } = await supabase.functions.invoke("submit-public-form", {
    body: { table, row, hp: guard.honeypot, ms: guard.elapsedMs() },
  });

  if (error) {
    // Body van een non-2xx response uitlezen voor de echte melding.
    let message = "Verzenden mislukt. Probeer het opnieuw of bel ons.";
    let reason: string | undefined;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const body = await res.clone().json();
        if (body?.error) message = body.error;
        reason = body?.reason;
      } catch {
        /* geen JSON-body */
      }
    }
    throw new PublicFormError(message, reason);
  }

  if (data && data.success === false) {
    throw new PublicFormError(data.error ?? "Verzenden mislukt.", data.reason);
  }

  return { id: data?.id ?? null };
}
