import { useEffect, useMemo, useState } from "react";
import { LeadKlantKoppeling } from "@/components/admin/LeadKlantKoppeling";
import { Link, useSearchParams } from "react-router-dom";
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
import { afrondMoment, mailStatusLabel, CONTACT_SOORTEN } from "@/lib/afhakers";
import { formatDateNL } from "@/lib/dateFormat";

type Status = "open" | "omgezet" | "gebeld" | "geen_interesse" | "onbereikbaar" | "dubbel" | "afgerond_na_herinnering";
type Overzicht = { concept_id: string; mails: { soort: string; op: string; status: string; fout: string | null }[]; contacten: { soort: string; tekst: string; op: string; door: string | null; in_tijdlijn: boolean }[]; aanvraag_lead_id: string | null; aanvraag_op: string | null };
interface Concept {
  id: string; created_at: string; laatst_actief_op: string; stap: number;
  email: string | null; telefoon: string | null; voornaam: string | null; achternaam: string | null;
  bedrijfsnaam: string | null; kvk: string | null; pakket: string | null; sector: string | null; pagina: string | null;
  attributie: Record<string, string> | null; status: Status; opvolg_notitie: string | null;
  opgevolgd_op: string | null; is_test: boolean; dubbel_lead_id: string | null;
  gekoppeld_onderneming_id: string | null;
  herinnering_verstuurd_op?: string | null; afhaak_geen_herinnering_reden?: string | null;
  gezien_op?: string | null; contact_vastgelegd_op?: string | null; afgerond_op?: string | null;
}

const STAPNAMEN = ["", "Pakket en contact", "Bedrijf", "Persoonsgegevens", "Betaling", "Controle"];
const STATUSLABEL: Record<Status, string> = {
  open: "Open", omgezet: "Omgezet", gebeld: "Gebeld", geen_interesse: "Geen interesse", onbereikbaar: "Onbereikbaar", dubbel: "Dubbel / fout", afgerond_na_herinnering: "Afgerond na herinnering",
};
const DERTIG_MIN = 30 * 60_000;

function bron(a: Concept["attributie"]): string {
  if (!a) return "Onbekend";
  const delen = [a.kanaal === "chatgpt_ads" ? "ChatGPT Ads" : a.kanaal === "herinnering" ? "Herinneringsmail" : a.kanaal, a.utm_source, a.utm_campaign].filter(Boolean);
  if (a.referrer) delen.push(a.referrer.replace(/^https?:\/\//, "").split("/")[0]);
  return delen.join(" · ") || "Onbekend";
}

export default function Afgehaakt() {
  const [zoekParams] = useSearchParams();
  const gekozen = zoekParams.get("record");
  const { user } = useAuth();
  const { toonTest } = useToonTestrecords();
  const qc = useQueryClient();
  const [rijen, setRijen] = useState<Concept[]>([]);
  const [laden, setLaden] = useState(true);
  const [toonOpgevolgd, setToonOpgevolgd] = useState(false);
  const [notities, setNotities] = useState<Record<string, string>>({});
  const [afgerond, setAfgerond] = useState<Record<string, string>>({});
  const [overzicht, setOverzicht] = useState<Record<string, Overzicht>>({});
  const [contactSoort, setContactSoort] = useState<Record<string, string>>({});
  const [contactTekst, setContactTekst] = useState<Record<string, string>>({});

  const laad = async () => {
    setLaden(true);
    let q = supabase.from("aanvraag_concepten")
      .select("id,created_at,laatst_actief_op,stap,email,telefoon,voornaam,achternaam,bedrijfsnaam,kvk,pakket,sector,pagina,attributie,status,opvolg_notitie,opgevolgd_op,is_test,dubbel_lead_id,gekoppeld_onderneming_id,herinnering_verstuurd_op,afhaak_geen_herinnering_reden,gezien_op,contact_vastgelegd_op,afgerond_op")
      .is("geanonimiseerd_op", null)
      .order("laatst_actief_op", { ascending: false }).limit(300);
    if (!toonTest) q = q.eq("is_test", false);
    if (gekozen) q = q.eq("id", gekozen);
    else q = q.neq("status", "omgezet");
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
      const { data: ov } = await (supabase.rpc as any)("afhakers_overzicht", { _ids: lijst.map((r) => r.id) });
      setOverzicht(Object.fromEntries(((ov as Overzicht[]) || []).map((o) => [o.concept_id, o])));
      // Lijst geopend: open afhakers gelden als gezien en tellen niet meer mee in de teller.
      const ongezien = lijst.filter((r) => r.status === "open" && !r.gezien_op && Date.now() - new Date(r.laatst_actief_op).getTime() > DERTIG_MIN).map((r) => r.id);
      if (ongezien.length) {
        const { error: gErr } = await (supabase.rpc as any)("afhakers_gezien", { _ids: ongezien });
        if (!gErr) qc.invalidateQueries({ queryKey: ["menu-tellers"] });
      }
    }
  };
  useEffect(() => { void laad(); }, [toonTest, gekozen]);

  const zichtbaar = useMemo(() => {
    const grens = Date.now() - DERTIG_MIN;
    return rijen.filter((r) => gekozen === r.id || (new Date(r.laatst_actief_op).getTime() < grens && (toonOpgevolgd || (r.status === "open" && !r.is_test))));
  }, [rijen, toonOpgevolgd, gekozen]);

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
  const contactVastleggen = async (r: Concept) => {
    const soort = contactSoort[r.id] ?? "gebeld";
    const tekst = (contactTekst[r.id] ?? "").trim();
    if (!tekst) { toast({ title: "Vul een korte toelichting in", variant: "destructive" }); return; }
    const { data, error } = await (supabase.rpc as any)("afhaker_contact_vastleggen", { _concept_id: r.id, _soort: soort, _tekst: tekst });
    if (error) { toast({ title: "Vastleggen mislukt", description: error.message, variant: "destructive" }); return; }
    setContactTekst((t) => ({ ...t, [r.id]: "" }));
    qc.invalidateQueries({ queryKey: ["menu-tellers"] });
    toast({ title: "Contact vastgelegd", description: (data as any)?.in_tijdlijn ? "Staat ook in de klanttijdlijn. Deze afhaker wordt niet automatisch afgerond." : "Koppel de afhaker aan een klant om het ook in de klanttijdlijn te zien. Wordt niet automatisch afgerond." });
    void laad();
  };
  const heropen = (r: Concept) => bewaar(r, { status: "open", is_test: false, dubbel_lead_id: null }, "Concept heropend");

  return (
    <AdminLayout>
            <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Afgehaakte aanvragen</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setToonOpgevolgd((v) => !v)}>
            {toonOpgevolgd ? "Alleen open tonen" : "Ook afgesloten tonen"}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Bezoekers die het aanvraagformulier begonnen en minstens 30 minuten niets meer deden, zonder de aanvraag af te ronden. Wie een herinneringsmail kreeg, wordt 7 dagen daarna automatisch afgerond als "Afgerond na herinnering", tenzij je contact vastlegt. De teller telt alleen afhakers zonder herinnering die je nog niet hebt gezien. Bankgegevens worden nooit bewaard.
          </p>
          {laden ? <Loader2 className="h-5 w-5 animate-spin" /> : zichtbaar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen afgehaakte aanvragen.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {zichtbaar.map((r) => {
                const naam = [r.voornaam, r.achternaam].filter(Boolean).join(" ") || "Naam onbekend";
                const leadLink = r.dubbel_lead_id ?? afgerond[r.id];
                const afgesloten = r.status !== "open" || r.is_test;
                const ov = overzicht[r.id];
                const afrond = afrondMoment(r.herinnering_verstuurd_op);
                return (
                  <div key={r.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words">{naam}</span>
                      {r.bedrijfsnaam && <span className="text-sm text-muted-foreground break-words">· {r.bedrijfsnaam}</span>}
                      <Badge variant={r.status === "open" ? "default" : "secondary"}>{STATUSLABEL[r.status]}</Badge>
                      {r.is_test && <Badge variant="outline">Test</Badge>}
                      {r.herinnering_verstuurd_op ? <Badge variant="outline">Herinnering verstuurd {formatDateTimeNL(r.herinnering_verstuurd_op)}</Badge>
                        : r.afhaak_geen_herinnering_reden ? <Badge variant="outline">geen herinnering: {r.afhaak_geen_herinnering_reden}</Badge> : null}
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
                    <div className="mb-3 space-y-1 rounded-md border border-border bg-muted/40 p-2 text-sm">
                      <p className="font-medium">Mail en vervolg</p>
                      {(ov?.mails ?? []).length === 0 ? <p className="text-muted-foreground">Geen herinneringsmail{r.afhaak_geen_herinnering_reden ? ` (${r.afhaak_geen_herinnering_reden})` : ""}.</p> : ov!.mails.map((m, i) => (
                        <p key={i}>{m.soort === "eenmalige herinnering" ? "Eenmalige herinnering" : "Herinneringsmail"} op {formatDateTimeNL(m.op)}: {mailStatusLabel(m.status)}{m.fout ? ` (${m.fout})` : ""}</p>
                      ))}
                      <p>{ov?.aanvraag_lead_id ? <>Daarna alsnog aangevraagd op {formatDateTimeNL(ov.aanvraag_op!)}. <Link to={`/admin/leads/${ov.aanvraag_lead_id}`} className="text-primary hover:underline">Bekijk aanvraag</Link></> : "Nog niet alsnog aangevraagd."}</p>
                      {r.status === "open" && afrond && !r.contact_vastgelegd_op && <p className="text-muted-foreground">Wordt op {formatDateNL(afrond.toISOString())} automatisch afgerond als er geen contact is vastgelegd.</p>}
                      {r.status === "afgerond_na_herinnering" && r.afgerond_op && <p className="text-muted-foreground">Automatisch afgerond op {formatDateTimeNL(r.afgerond_op)}.</p>}
                      {(ov?.contacten ?? []).map((c, i) => (
                        <p key={`c${i}`}><span className="font-medium">{CONTACT_SOORTEN.find((x) => x.waarde === c.soort)?.label ?? c.soort}</span> op {formatDateTimeNL(c.op)}{c.door ? ` door ${c.door}` : ""}: {c.tekst}{c.in_tijdlijn ? " (in klanttijdlijn)" : ""}</p>
                      ))}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={`Contact vastleggen bij ${naam}`}>
                      {CONTACT_SOORTEN.map((s) => (
                        <Button key={s.waarde} size="sm" type="button" variant={(contactSoort[r.id] ?? "gebeld") === s.waarde ? "default" : "outline"} onClick={() => setContactSoort((x) => ({ ...x, [r.id]: s.waarde }))}>{s.label}</Button>
                      ))}
                    </div>
                    <Textarea
                      aria-label={`Contact bij ${naam}`}
                      placeholder="Wat is er besproken of gemaild?"
                      className="mb-2 min-h-[60px]"
                      value={contactTekst[r.id] ?? ""}
                      onChange={(e) => setContactTekst((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <LeadKlantKoppeling lead={r} bron="aanvraag_concepten" onGewijzigd={() => void laad()} />
                      <Button size="sm" onClick={() => contactVastleggen(r)}>Contact vastleggen</Button>
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
