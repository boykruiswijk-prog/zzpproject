import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateNL } from "@/lib/dateFormat";
import { verwachtCredit, euro } from "@/lib/creditVoorstel";
import { opzegZonderCredit } from "@/lib/opzegBeleid";

/** Toont direct onder het datumveld het creditbedrag en de periode, met dezelfde gegevens (credit_voorstel) en rekenregel als de goedkeuringspagina. */
export function CreditVoorbeeld({ contract, datum }: { contract: any; datum: string }) {
  const [tekst, setTekst] = useState<string>("");
  useEffect(() => {
    let weg = false;
    if (!datum) { setTekst(""); return; }
    if (opzegZonderCredit(contract)) { setTekst("Geen creditnota (per dag opzegbaar)."); return; }
    (async () => {
      const { data, error } = await (supabase.rpc as any)("credit_voorstel", { _contract_id: contract.id, _einddatum: datum });
      if (weg) return;
      if (error || !data) { setTekst("Creditbedrag kon niet worden berekend."); return; }
      const v = verwachtCredit(data, datum, data.planner_perioden ?? []);
      setTekst(v && v.bedrag > 0 && v.tm
        ? `Creditnota ${euro(v.bedrag)} over ${formatDateNL(v.vanaf)} t/m ${formatDateNL(v.tm)}.`
        : "Geen creditnota: er is niet verder gefactureerd dan deze datum.");
    })();
    return () => { weg = true; };
  }, [contract, datum]);
  if (!tekst) return null;
  return <p className="text-xs font-medium" data-testid="credit-voorbeeld">Regel {contract.bron_rij}: {tekst}</p>;
}
