// Centrale aan/uit-check voor externe integraties (tabel public.integratie_config).
// Fail-closed: bij twijfel of fout wordt de integratie als UIT beschouwd, zodat er
// nooit onbedoeld naar een externe partij wordt gebeld.

// deno-lint-ignore no-explicit-any
export async function isIntegratieEnabled(supabase: any, naam: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("integratie_config")
      .select("enabled")
      .eq("naam", naam)
      .maybeSingle();
    if (error) {
      console.error(`integratie_config ${naam}: leesfout — integratie blijft uit:`, error.message);
      return false;
    }
    return data?.enabled === true;
  } catch (e) {
    console.error(`integratie_config ${naam}: onverwachte fout — integratie blijft uit:`, e);
    return false;
  }
}
