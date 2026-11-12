import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { useAuth } from "@/contexts/AuthContext";
import { datumsFout, datumsMelding, laatsteDagOud } from "../../../../supabase/functions/_shared/rechtsvormwijziging";

type Aanvraag = { id: string; status: string; details: any };

/** Beoordeling van een zelfservice-rechtsvormwijziging. Geen bankgegevens: alleen of er een nieuwe machtiging is (kenmerk). */
export function RechtsvormBeoordeling({ aanvraag, onKlaar }: { aanvraag: Aanvraag; onKlaar: () => void }) {
  const { isSupervisorOrAdmin, isVerzekering } = useAuth() as any;
  const d = aanvraag.details ?? {}; const n = d.nieuw ?? {}; const oud = d.huidige_onderneming ?? {};
  const [bezig, setBezig] = useState(false);
  const datumFout = datumsFout(d.einddatum, d.ingangsdatum, "2000-01-01");
  const goedgekeurd = !!d.goedgekeurd;

  async function polisOmzetten(naar: string): Promise<boolean> {
    if (!d.polis_id) return true;
    const { data: pol } = await supabase.from("policies").select("id,status,onderneming_id").eq("id", d.polis_id).maybeSingle();
    if (!pol || pol.status !== "geldig" || pol.onderneming_id === naar) return true;
    const { data, error } = await supabase.functions.invoke("generate-certificate", {
      body: { actie: "omzetten", policy_id: d.polis_id, naar_onderneming_id: naar, ingangsdatum: d.ingangsdatum, reden: `Rechtsvormwijziging Mijn ZP, verzoek ${aanvraag.id.slice(0, 8)}` },
    });
    let melding = (data as any)?.error as string | undefined;
    if (error && !melding) { try { melding = (await (error as any)?.context?.json?.())?.error; } catch { /* geen body */ } }
    if (error || melding) { toast.error(`Goedgekeurd, maar polis omzetten mislukte: ${melding ?? error?.message}. Gebruik Polis overnemen op de nieuwe klantkaart en klik daarna hier opnieuw.`); return false; }
    return true;
  }

  async function goedkeuren() {
    setBezig(true);
    let naar: string | undefined = d.goedgekeurd?.naar_onderneming_id;
    if (!goedgekeurd) {
      const { data, error } = await (supabase.rpc as any)("rechtsvormwijziging_goedkeuren", { _aanvraag: aanvraag.id });
      if (error) { setBezig(false); toast.error(error.message); return; }
      naar = (data as any)?.naar_onderneming_id;
    }
    const ok = naar ? await polisOmzetten(naar) : false;
    if (ok) {
      const { error } = await (supabase.rpc as any)("rechtsvormwijziging_afronden", { _aanvraag: aanvraag.id });
      if (error) toast.error(error.message); else toast.success("Rechtsvormwijziging verwerkt. Ondernemingen gekoppeld, nieuw certificaat klaar om te controleren. Er is niets gemaild.");
    }
    setBezig(false); onKlaar();
  }

  return (
    <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm" data-testid="rechtsvorm-beoordeling">
      <p className="font-semibold">Rechtsvormwijziging via Mijn ZP</p>
      <p>Van <strong>{oud.naam ?? "onbekend"}</strong> ({oud.rechtsvorm ?? "rechtsvorm onbekend"}, KvK {oud.kvk ?? "-"}) naar <strong>{n.naam}</strong> ({n.rechtsvorm}, KvK {n.kvk}).</p>
      <p>Adres nieuw: {n.straat} {n.huisnummer}, {n.postcode} {n.plaats}, {n.land}</p>
      <p>Einddatum oud {d.einddatum ? formatDateNL(d.einddatum) : "-"}, laatste dekkingsdag {d.einddatum ? formatDateNL(laatsteDagOud(d.einddatum)) : "-"}; ingangsdatum nieuw {d.ingangsdatum ? formatDateNL(d.ingangsdatum) : "-"}.</p>
      {datumFout && <p className="text-destructive">{datumFout}</p>}
      <p>Nieuwe incassomachtiging: {d.nieuwe_rekening ? `ja, kenmerk ${d.mandaatkenmerk}` : "nee, rekening blijft gelijk"}.</p>
      <p className="text-muted-foreground">Voorgestelde koppeling: {oud.id ? <Link className="text-primary underline" to={`/admin/klanten/${oud.id}`}>{oud.naam}</Link> : "onbekend"} wordt de vorige onderneming. Bij goedkeuren: oude contracten stoppen precies op de opgegeven einddatum (bestaande creditregels; geen automatische credit voor een overlap), het BAV + AVB-contract en de polis gaan mee naar de nieuwe onderneming (geen dubbele factuur), ondernemingen worden gekoppeld. Er wordt niets gemaild en niets naar Exact gestuurd.</p>
      {aanvraag.status !== "afgerond" && (isSupervisorOrAdmin || isVerzekering) && (
        <Button size="sm" onClick={goedkeuren} disabled={bezig || !!datumFout}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{goedgekeurd ? "Polis omzetten en afronden" : "Data gecontroleerd, goedkeuren"}</Button>
      )}
    </div>
  );
}
