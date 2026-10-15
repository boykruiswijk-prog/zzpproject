// D9: overzicht mislukte incasso's met cyclus, mailstatus per stap en knoppen. Team mag kijken.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { BetaaldKnop, IncassoMisluktKnop, RoyementKnop, cyclusInfo, euroNL, STAP_LABEL, type IncassoRij, type IncassoStap } from "@/components/admin/incasso/Incasso";

const STATUS_LABEL: Record<string, string> = { open: "Open", betaald: "Betaald", royement_voorgesteld: "Royement voorgesteld", geroyeerd: "Geroyeerd", vervallen: "Vervallen" };
const MAIL_LABEL: Record<string, string> = { niet_verzonden_schakelaar_uit: "niet verzonden (mail staat uit)", verzonden: "verzonden", geen_mail: "geen mail", niet_verzonden_test: "testklant" };

export default function Incassos() {
  const { toonTest } = useToonTestrecords();
  const [alle, setAlle] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["incassos", alle, toonTest],
    queryFn: async () => {
      let q = supabase.from("incasso_mislukt" as any).select("*, ondernemingen(naam), incasso_cyclus_log(stap,uitgevoerd_op,mail_status)").order("mislukt_op", { ascending: false });
      if (!alle) q = q.in("status", ["open", "royement_voorgesteld"]);
      const { data } = await q;
      return ((data ?? []) as any[]).filter((r) => toonTest || !r.is_test) as (IncassoRij & { ondernemingen?: { naam: string }; incasso_cyclus_log?: { stap: IncassoStap; uitgevoerd_op: string; mail_status: string | null }[] })[];
    },
  });
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Incasso's</h1>
          <Button variant="outline" size="sm" onClick={() => setAlle(!alle)}>{alle ? "Alleen open" : "Alle tonen"}</Button>
        </div>
        <p className="text-sm text-muted-foreground">Herinneringen op dag 0, 14 en 28; op dag 42 alleen een voorstel voor royement. Er wordt nooit automatisch geroyeerd en er gaat niets naar Exact. De herinneringen en de royementsbevestiging gaan per mail naar de klant; Boy heeft de teksten goedgekeurd op 15-10-2026 (zie Klantmails).</p>
        <Card><CardHeader><CardTitle className="text-base">Mislukte incasso's ({data?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data ?? []).length === 0 && <p className="text-muted-foreground">Geen mislukte incasso's.</p>}
            {(data ?? []).map((r) => { const c = cyclusInfo(r); return (
              <div key={r.id} className="space-y-1 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/klanten/${r.onderneming_id}`} className="font-medium text-primary hover:underline">{r.ondernemingen?.naam ?? "Klant"}</Link>
                  <span>factuur {r.factuurnummer} · {euroNL(r.bedrag)} · mislukt {formatDateNL(r.mislukt_op)}</span>
                  <Badge variant={r.status === "open" ? "secondary" : "outline"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  {r.dekking_opgeschort_sinds && ["open", "royement_voorgesteld"].includes(r.status) && <Badge variant="destructive">Dekking opgeschort sinds {formatDateNL(r.dekking_opgeschort_sinds)} (incasso)</Badge>}
                  <span className="ml-auto flex gap-2">
                    {["open", "royement_voorgesteld"].includes(r.status) && <BetaaldKnop id={r.id} onKlaar={() => refetch()} />}
                    {r.status === "royement_voorgesteld" && <RoyementKnop id={r.id} onKlaar={() => refetch()} />}
                  </span>
                </div>
                {r.status === "open" && <p className="text-muted-foreground">Dag {c.dag} in de cyclus{c.volgende ? ` · volgende stap: ${c.volgende.label} op ${formatDateNL(c.volgende.datum)}` : ""}</p>}
                {(r.incasso_cyclus_log ?? []).length > 0 && <ul className="text-xs text-muted-foreground">
                  {(r.incasso_cyclus_log ?? []).sort((a, b) => a.uitgevoerd_op.localeCompare(b.uitgevoerd_op)).map((l) => <li key={l.stap}>{STAP_LABEL[l.stap]} op {formatDateNL(l.uitgevoerd_op)}: {MAIL_LABEL[l.mail_status ?? ""] ?? l.mail_status ?? "bezig"}</li>)}
                </ul>}
              </div>); })}
          </CardContent>
        </Card>
        <ExactVoorstellen onBevestigd={() => refetch()} />
      </div>
    </AdminLayout>
  );
}

/** Alleen-lezen detectie uit Exact: het team bevestigt zelf per kandidaat. Nooit automatisch taken. */
function ExactVoorstellen({ onBevestigd }: { onBevestigd: () => void }) {
  const { toast } = useToast();
  const [bezig, setBezig] = useState(false);
  const [res, setRes] = useState<any>(null);
  async function haal(modus: "probe" | "voorstellen") {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("incasso-detectie-exact", { body: { modus } });
    setBezig(false);
    if (error || (data as any)?.error) return toast({ title: "Ophalen uit Exact mislukt", description: error?.message ?? String((data as any)?.error), variant: "destructive" });
    setRes(data);
  }
  return (
    <Card><CardHeader><CardTitle className="text-base">Mogelijk mislukte incasso's uit Exact</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Leest alleen openstaande posten over de vervaldatum uit Exact. Er wordt niets geschreven; bevestig zelf per regel.</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={bezig} onClick={() => haal("voorstellen")}>Voorstellen ophalen</Button>
          <Button size="sm" variant="ghost" disabled={bezig} onClick={() => haal("probe")}>Velden bekijken (probe)</Button></div>
        {res?.modus === "probe" && <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(res.bronnen, null, 2)}</pre>}
        {res?.modus === "voorstellen" && <>
          <p>{res.kandidaten.length} kandidaten (van {res.verlopen} verlopen posten).</p>
          {res.kandidaten.map((k: any) => (
            <div key={`${k.onderneming_id}-${k.factuurnummer}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <span className="font-medium">{k.klant}</span><span>factuur {k.factuurnummer} · {euroNL(k.bedrag)} · vervallen {formatDateNL(k.vervaldatum)}</span>
              <span className="ml-auto"><IncassoMisluktKnop ondernemingId={k.onderneming_id} factuurnummer={k.factuurnummer} bedrag={k.bedrag} bron="exact_detectie" label="Bevestig als mislukt" onGemeld={onBevestigd} /></span>
            </div>))}
        </>}
      </CardContent>
    </Card>
  );
}
