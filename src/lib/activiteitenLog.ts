import { supabase } from "@/integrations/supabase/client";

export interface LogActiviteitInput {
  actie_type: string;
  omschrijving: string;
  lead_id?: string | null;
  klant_email?: string | null;
}

/**
 * Schrijft een regel weg in public.activiteiten_log.
 * Faalt stil (console.error) zodat een falende log-schrijf de UI-flow niet blokkeert.
 * Alleen aanroepen NA een succesvolle handeling.
 */
export async function logActiviteit(input: LogActiviteitInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let naam: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    naam = profile?.full_name ?? user.email ?? null;

    const email = input.klant_email ? input.klant_email.trim().toLowerCase() : null;

    const { error } = await supabase.from("activiteiten_log").insert({
      actie_type: input.actie_type,
      omschrijving: input.omschrijving,
      uitgevoerd_door: user.id,
      uitgevoerd_door_naam: naam,
      lead_id: input.lead_id ?? null,
      klant_email: email,
    });
    if (error) console.error("logActiviteit fout:", error);
  } catch (e) {
    console.error("logActiviteit exception:", e);
  }
}
