import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone } from "lucide-react";

type Status = "open" | "omgezet" | "gebeld" | "geen_interesse" | "onbereikbaar" | "dubbel";
interface Concept {
  id: string; created_at: string; laatst_actief_op: string; stap: number;
  email: string | null; telefoon: string | null; voornaam: string | null; achternaam: string | null;
  bedrijfsnaam: string | null; kvk: string | null; pakket: string | null; sector: string | null; pagina: string | null;
  attributie: Record<string, string> | null; status: Status; opvolg_notitie: string | null;
  opgevolgd_op: string | null; is_test: boolean; dubbel_lead_id: string | null;
}

const STAPNAMEN = ["", "Pakket en contact", "Bedrijf", "Persoonsgegevens", "Betaling", "Controle"];
const STATUSLABEL: Record<Status, string> = {
  open: "Open", omgezet: "Omgezet", gebeld: "Gebeld", geen_interesse: "Geen interesse", onbereikbaar: "Onbereikbaar", dubbel: "Dubbel / fout",
};
const DERTIG_MIN = 30 * 60_000;

function bron(a: Concept["attributie"]): string {
  if (!a) return "Onbekend";
  const delen = [a.kanaal, a.utm_source, a.utm_campaign].filter(Boolean);
  if (a.referrer) delen.push(a.referrer.replace(/^https?:\/\//, "").split("/")[0]);
  return delen.join(" · ") || "Onbekend";
}

export default function Afgehaakt() {
  const { user } = useAuth();
  const { toonTest } = useToonTestrecords();
  const qc = useQueryClient();
  const [rijen, setRijen] = useState<Concept[]>([]);
  const [laden, setLaden] = useState(true);
  const [toonOpgevolgd, setToonOpgevolgd] = useState(false);
  const [notities, setNotities] = useState<Record<string, string>>({});
  const [afgerond, setAfgerond] = useState<Record<string, string>>({});

  const laad = async () => {
    setLaden(true);
    let q = supabase.from("aanvraag_concepten")
      .select("id,created_at,laatst_actief_op,stap,email,telefoon,voornaam,achternaam,bedrijfsnaam,kvk,pakket,sector,pagina,attributie,status,opvolg_notitie,opgevolgd_op,is_test,dubbel_lead_id")
      .neq("status", "omgezet").is("geanonimiseerd_op", null)
      .order("laatst_actief_op", { ascending: false }).limit(300);
    if (!toonTest) q = q.eq("is_test", false);
    const { data, error } = await q;
    if (error) toast({ title: "Laden mislukt", description: error.message, variant: "destructive" });
    const lijst = (data as unknown as Concept[]) || [];
    setRijen(lijst);
    setLaden(false);
    if (lijst.length) {
      const { data: m } = await (supabase.rpc as any)("concept_afgeronde_leads", { _ids: lijst.map((r) => r.id) });
      const kaart: Record<string, string> = {};
      for (const r of (m as { concept_id: string; lead_id: string }[]) || []) kaart[r.concept_id] = r.lead_id;
      setAfgerond(kaart);
    }
  };
  useEffect(() => { void laad(); }, [toonTest]);

  const zichtbaar = useMemo(() => {
    const grens = Date.now() - DERTIG_MIN;
    return rijen.filter((r) => new Date(r.laatst_actief_op).getTime() < grens && (toonOpgevolgd || (r.status === "open" && !r.is_test)));
  }, [rijen, toonOpgevolgd]);

  const bewaar = async (r: Concept, extra: Partial<Concept>, titel: string) => {
    const notitie = notities[r.id] ?? r.opvolg_notitie ?? "";
    const wijziging = { ...extra, opvolg_notitie: notitie.trim().slice(0, 2000) || null, opgevolgd_door: user?.id ?? null, opgevolgd_op: new Date().toISOString() };
    const { error } = await supabase.from("aanvraag_concepten").update(wijziging as any).eq("id", r.id);
    if (error) { toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" }); return; }
    setRijen((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...wijziging } as Concept : x)));
    qc.invalidateQueries({ queryKey: ["menu-tellers"] });
    toast({ title: titel });
  };
  const zetStatus = (r: Concept, status: Status) =>
    bewaar(r, status === "open" ? { status, dubbel_lead_id: null } : { status }, `Status: ${STATUSLABEL[status]}`);
  const dubbel = (r: Concept) => bewaar(r, { status: "dubbel", dubbel_lead_id: afgerond[r.id] ?? null }, afgerond[r.id] ? "Afgesloten als dubbel, gekoppeld aan aanvraag" : "Afgesloten als dubbel / fout");
  const heropen = (r: Concept) => bewaar(r, { status: "open", is_test: false, dubbel_lead_id: null }, "Concept heropend");

  return (
    <AdminLayout>
      <Helmet><title>Afgehaakte aanvragen | Beheer</title></Helmet>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Afgehaakte aanvragen</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setToonOpgevolgd((v) => !v)}>
            {toonOpgevolgd ? "Alleen open tonen" : "Ook afgesloten tonen"}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Bezoekers die het aanvraagformulier begonnen en minstens 30 minuten niets meer deden, zonder de aanvraag af te ronden. Bankgegevens worden nooit bewaard.
          </p>
          {laden ? <Loader2 className="h-5 w-5 animate-spin" /> : zichtbaar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen afgehaakte aanvragen.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {zichtbaar.map((r) => {
                const naam = [r.voornaam, r.achternaam].filter(Boolean).join(" ") || "Naam onbekend";
                const leadLink = r.dubbel_lead_id ?? afgerond[r.id];
                const afgesloten = r.status !== "open" || r.is_test;
                return (
                  <div key={r.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words">{naam}</span>
                      {r.bedrijfsnaam && <span className="text-sm text-muted-foreground break-words">· {r.bedrijfsnaam}</span>}
                      <Badge variant={r.status === "open" ? "default" : "secondary"}>{STATUSLABEL[r.status]}</Badge>
                      {r.is_test && <Badge variant="outline">Test</Badge>}
                    </div>
                    {leadLink && (
                      <Link to={`/admin/leads/${leadLink}`} className="mb-2 inline-block text-sm font-medium text-primary hover:underline">
                        Heeft al een afgeronde aanvraag, bekijk aanvraag
                      </Link>
                    )}
                    <div className="mb-3 flex flex-col gap-1 text-sm">
                      {r.email && <a href={`mailto:${r.email}`} className="inline-flex min-w-0 items-center gap-2 text-primary hover:underline"><Mail className="h-4 w-4 shrink-0" /><span className="break-all">{r.email}</span></a>}
                      {r.telefoon && <a href={`tel:${r.telefoon}`} className="inline-flex items-center gap-2 text-primary hover:underline"><Phone className="h-4 w-4 shrink-0" />{r.telefoon}</a>}
                    </div>
                    <dl className="mb-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Afgehaakt bij</dt><dd>Stap {r.stap}: {STAPNAMEN[r.stap] ?? ""}</dd>
                      <dt className="text-muted-foreground">Pakket</dt><dd className="break-words">{r.pakket || "-"}</dd>
                      {r.sector && <><dt className="text-muted-foreground">Sector</dt><dd className="break-words">{r.sector}</dd></>}
                      {r.kvk && <><dt className="text-muted-foreground">KvK</dt><dd>{r.kvk}</dd></>}
                      <dt className="text-muted-foreground">Pagina</dt><dd className="break-all">{r.pagina || "-"}</dd>
                      <dt className="text-muted-foreground">Bron</dt><dd className="break-words">{bron(r.attributie)}</dd>
                      <dt className="text-muted-foreground">Laatst actief</dt><dd>{formatDateTimeNL(r.laatst_actief_op)}</dd>
                      {r.opgevolgd_op && <><dt className="text-muted-foreground">Opgevolgd</dt><dd>{formatDateTimeNL(r.opgevolgd_op)}</dd></>}
                    </dl>
                    <Textarea
                      aria-label={`Notitie bij ${naam}`}
                      placeholder="Notitie (optioneel)"
                      className="mb-2 min-h-[60px]"
                      value={notities[r.id] ?? r.opvolg_notitie ?? ""}
                      onChange={(e) => setNotities((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => zetStatus(r, "gebeld")}>Gebeld</Button>
                      <Button size="sm" variant="outline" onClick={() => zetStatus(r, "onbereikbaar")}>Onbereikbaar</Button>
                      <Button size="sm" variant="outline" onClick={() => zetStatus(r, "geen_interesse")}>Geen interesse</Button>
                      <Button size="sm" variant="outline" onClick={() => dubbel(r)}>Dubbel / fout</Button>
                      {!r.is_test && <Button size="sm" variant="outline" onClick={() => bewaar(r, { is_test: true }, "Gemarkeerd als test")}>Test</Button>}
                      {afgesloten && <Button size="sm" variant="ghost" onClick={() => heropen(r)}>Heropenen</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
