import { useState } from "react";
import { Input } from "@/components/ui/input";
import { IbanInzien } from "@/components/admin/IbanInzien";

/**
 * IBAN op de leadpagina. Het huidige IBAN staat gemaskeerd; volledig alleen via de knop (gelogd).
 * Een nieuw IBAN typ je in het veld; opslaan gebeurt bij het verlaten van het veld.
 */
export function LeadIbanVeld({ leadId, gemaskeerd, locked, onOpslaan }: { leadId: string; gemaskeerd: string | null; locked: boolean; onOpslaan: (iban: string) => void }) {
  const [nieuw, setNieuw] = useState("");
  return (
    <div className="mt-4">
      <label className="text-muted-foreground text-sm block mb-1">
        IBAN {gemaskeerd ? "" : "(nog niet ingevuld)"}
        {locked && <span className="ml-2 text-xs text-amber-600">(vergrendeld na activatie — supervisor/admin)</span>}
      </label>
      {gemaskeerd && <div className="mb-2 text-sm"><IbanInzien bron="lead" id={leadId} gemaskeerd={gemaskeerd} /></div>}
      <Input
        className="max-w-xs"
        placeholder={gemaskeerd ? "Nieuw IBAN invullen" : "NL00BANK0000000000"}
        value={nieuw}
        disabled={locked}
        onChange={(e) => setNieuw(e.target.value)}
        onBlur={() => { const v = nieuw.trim(); if (v) { onOpslaan(v); setNieuw(""); } }}
      />
    </div>
  );
}
