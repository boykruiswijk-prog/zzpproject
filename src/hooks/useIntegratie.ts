import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Leest de aan/uit-vlag van een externe integratie uit integratie_config.
 * Fail-closed: bij een fout of onbekende naam blijft de integratie uit,
 * zodat UI die naar de integratie verwijst verborgen blijft.
 */
export function useIntegratie(naam: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let actief = true;
    (async () => {
      const { data, error } = await supabase
        .from("integratie_config")
        .select("enabled")
        .eq("naam", naam)
        .maybeSingle();
      if (!actief) return;
      setEnabled(!error && data?.enabled === true);
      setLoading(false);
    })();
    return () => {
      actief = false;
    };
  }, [naam]);

  return { enabled, loading };
}
