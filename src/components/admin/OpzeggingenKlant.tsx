import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { PRODUCT_LABEL, type Product } from "@/lib/klantContracten";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";

export const KOPPELING_LABEL: Record<string, string> = {
  zeker: "Automatisch zeker",
  voorstel: "Voorstel",
  niet_gekoppeld: "Niet gekoppeld",
};
export const METHODE_LABEL: Record<string, string> = {
  email: "op e-mail",
  contractnummer: "op contractnummer",
  email_meerdere: "e-mail bij meerdere klanten",
  kvk: "op KvK",
  bedrijfsnaam: "op bedrijfsnaam",
  handmatig: "handmatig bevestigd",
};

type Aanvraag = {
  id: string; created_at: string; voornaam: string; achternaam: string; email: string; polisnummer: string;
  details: any; koppeling_status: string | null; koppeling_methode: string | null; koppeling_details: any;
  onderneming_id: string | null; opzegging_verwerkt_op: string | null; is_test: boolean;
};

const KOLOMMEN = "id,created_at,voornaam,achternaam,email,polisnummer,details,koppeling_status,koppeling_methode,koppeling_details,onderneming_id,opzegging_verwerkt_op,is_test";

function KoppelBadge({ a }: { a: Aanvraag }) {
  const s = a.koppeling_status ?? "niet_gekoppeld";
  return (
    <Badge variant={s === "zeker" ? "secondary" : "outline"} className={s === "zeker" ? "" : "border-amber-500 text-amber-700"}>
      {KOPPELING_LABEL[s] ?? s}{a.koppeling_methode ? ` · ${METHODE_LABEL[a.koppeling_methode] ?? a.koppeling_methode}` : ""}
    </Badge>
  );
}

/** Opzeggingen op de klantdetailpagina, met "Opzegging verwerken". */
export function OpzeggingenKlant({ ondernemingId, contracten, onGewijzigd }: { ondernemingId: string; contracten: any[]; onGewijzigd: () => void }) {
  const { toast } = useToast();
  const { toonTest } = useToonTestrecords();
  const [lijst, setLijst] = useState<Aanvraag[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);

  async function laad() {
    const { data } = await supabase.from("klant_service_aanvragen").select(KOLOMMEN).eq("type", "opzeggen").eq("onderneming_id", ondernemingId).order("created_at", { ascending: false });
    setLijst(((data ?? []) as Aanvraag[]).filter((a) => toonTest || !a.is_test));
  }
  useEffect(() => { laad(); }, [ondernemingId, toonTest]);

  const lopend = contracten.filter((c) => c.status === "actief" || c.status === "loopt_af");

  async function bevestig(a: Aanvraag) {
    setBezig(true);
    const { error } = await supabase.rpc("koppel_opzegging", { _aanvraag_id: a.id, _onderneming_id: ondernemingId });
    setBezig(false);
    if (error) return toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Koppeling bevestigd" }); laad();
  }

  async function verwerk(a: Aanvraag) {
    setBezig(true);
    const { data, error } = await supabase.rpc("verwerk_opzegging", { _aanvraag_id: a.id, _contract_ids: Array.from(gekozen) });
    setBezig(false);
    if (error) return toast({ title: "Verwerken mislukt", description: error.message, variant: "destructive" });
    const cr = ((data as any)?.credits ?? []) as any[];
    const creditTekst = cr.filter((c) => c.status && c.status !== "niet_nodig").map((c) => `Rij ${c.bron_rij}: ${c.status === "te_maken" ? "creditnota gepland" : c.melding ?? c.status}`).join(" · ");
    toast({ title: "Opzegging verwerkt", description: `${(data as any)?.regels} regel(s) lopen af per ${formatDateNL((data as any)?.einddatum)}.${creditTekst ? " " + creditTekst : ""}` });
    setOpen(null); setGekozen(new Set()); laad(); onGewijzigd();
  }

  if (lijst.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Opzeggingen</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {lijst.map((a) => (
          <div key={a.id} className="rounded-md border border-border p-3 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/admin/service-aanvragen/${a.id}`} className="font-medium hover:text-primary">{a.voornaam} {a.achternaam}</Link>
              <span className="text-muted-foreground truncate">{a.email}</span>
              <KoppelBadge a={a} />
              {a.is_test && <Badge variant="outline">Test</Badge>}
            </div>
            <div className="text-muted-foreground">
              Ontvangen {formatDateNL(a.created_at)} · gewenste opzegdatum {formatDateNL(a.details?.opzegdatum)} · polis/contract {a.polisnummer || "—"}
              {a.details?.bedrijfsnaam && <> · bedrijf {a.details.bedrijfsnaam}</>}
            </div>
            {a.opzegging_verwerkt_op ? (
              <p className="text-emerald-700">Verwerkt op {formatDateNL(a.opzegging_verwerkt_op)}.</p>
            ) : a.koppeling_status !== "zeker" ? (
              <Button size="sm" variant="outline" disabled={bezig} onClick={() => bevestig(a)}>Koppeling met deze klant bevestigen</Button>
            ) : open !== a.id ? (
              <Button size="sm" onClick={() => { setOpen(a.id); setGekozen(new Set(lopend.map((c) => c.id))); }}>Opzegging verwerken</Button>
            ) : (
              <div className="space-y-2">
                <p>Kies de contractregel(s). Ze krijgen einddatum {formatDateNL(a.details?.opzegdatum)} en status "loopt af".</p>
                {lopend.length === 0 && <p className="text-muted-foreground">Geen lopende contractregels.</p>}
                {lopend.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <Checkbox checked={gekozen.has(c.id)} onCheckedChange={(v) => { const s = new Set(gekozen); v ? s.add(c.id) : s.delete(c.id); setGekozen(s); }} />
                    <span>Rij {c.bron_rij} · {PRODUCT_LABEL[c.product as Product] ?? c.product} · {c.cyclus === "jaar" ? "jaar" : "maand"}</span>
                  </label>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" disabled={bezig || gekozen.size === 0} onClick={() => verwerk(a)}>Bevestig en verwerk</Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Annuleren</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Lijst "Opzeggingen te koppelen": voorstel of niet gekoppeld, nog niet verwerkt. */
export function OpzeggingenTeKoppelen() {
  const { toast } = useToast();
  const { toonTest } = useToonTestrecords();
  const [lijst, setLijst] = useState<Aanvraag[]>([]);
  const [namen, setNamen] = useState<Map<string, string>>(new Map());
  const [code, setCode] = useState<Record<string, string>>({});

  async function laad() {
    const { data } = await supabase.from("klant_service_aanvragen").select(KOLOMMEN).eq("type", "opzeggen").is("opzegging_verwerkt_op", null).order("created_at", { ascending: false });
    const l = ((data ?? []) as Aanvraag[]).filter((a) => (toonTest || !a.is_test) && (a.koppeling_status ?? "niet_gekoppeld") !== "zeker");
    setLijst(l);
    const ids = l.map((a) => a.onderneming_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: o } = await supabase.from("ondernemingen").select("id,naam,exact_relatie_code").in("id", ids);
      setNamen(new Map((o ?? []).map((x) => [x.id, `${x.naam ?? "—"} (${x.exact_relatie_code ?? "geen code"})`])));
    }
  }
  useEffect(() => { laad(); }, [toonTest]);

  async function koppelOpCode(a: Aanvraag) {
    const c = (code[a.id] ?? "").trim();
    const { data: o } = await supabase.from("ondernemingen").select("id").eq("exact_relatie_code", c).maybeSingle();
    if (!o) return toast({ title: "Geen klant met deze relatiecode", variant: "destructive" });
    const { error } = await supabase.rpc("koppel_opzegging", { _aanvraag_id: a.id, _onderneming_id: o.id });
    if (error) return toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Gekoppeld" }); laad();
  }

  return (
    <Card id="opzeggingen">
      <CardHeader><CardTitle className="text-base">Opzeggingen te koppelen ({lijst.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {lijst.length === 0 ? <p className="text-sm text-muted-foreground">Geen opzeggingen die op koppeling wachten.</p> : (
          <table className="w-full table-fixed text-sm min-w-[900px]">
            <thead><tr className="text-left text-muted-foreground"><th className="p-2 font-normal w-[18%]">Aanvrager</th><th className="p-2 font-normal w-[14%]">Ontvangen</th><th className="p-2 font-normal w-[20%]">Koppeling</th><th className="p-2 font-normal w-[24%]">Voorgestelde klant</th><th className="p-2 font-normal w-[24%]">Handmatig koppelen</th></tr></thead>
            <tbody>{lijst.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30 align-top">
                <td className="p-2 min-w-0"><Link to={`/admin/service-aanvragen/${a.id}`} className="block truncate font-medium hover:text-primary">{a.voornaam} {a.achternaam}</Link><div className="truncate text-xs text-muted-foreground" title={a.email}>{a.email}</div></td>
                <td className="p-2 tabular-nums">{formatDateNL(a.created_at)}<div className="text-xs text-muted-foreground">per {formatDateNL(a.details?.opzegdatum)}</div></td>
                <td className="p-2"><KoppelBadge a={a} /></td>
                <td className="p-2 min-w-0">{a.onderneming_id ? <Link to={`/admin/klanten/${a.onderneming_id}`} className="block truncate font-medium hover:text-primary">{namen.get(a.onderneming_id) ?? "Klant"}</Link> : <span className="text-muted-foreground">—</span>}
                  {a.details?.bedrijfsnaam && <div className="truncate text-xs text-muted-foreground">Opgegeven: {a.details.bedrijfsnaam}</div>}</td>
                <td className="p-2"><div className="flex gap-2"><Input className="h-8" placeholder="Relatiecode" aria-label="Relatiecode" value={code[a.id] ?? ""} onChange={(e) => setCode({ ...code, [a.id]: e.target.value })} /><Button size="sm" variant="outline" onClick={() => koppelOpCode(a)}>Koppel</Button></div></td>
              </tr>))}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
