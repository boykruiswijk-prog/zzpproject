import { useQuery } from "@tanstack/react-query";
import { CyberDatums } from "@/components/admin/CyberDatums";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Phone } from "lucide-react";
import { formatDateNL, formatDateTimeNL } from "@/lib/dateFormat";
import { PRODUCT_LABEL, maskeerIban, type Product } from "@/lib/klantContracten";
import { contractEindStatus, kiesBavNummer, useBavRijen } from "@/lib/bavNummer";
import { BavNummer } from "./BavNummer";
import { GegevensWijzigen } from "./GegevensWijzigen";
import { PortalUitnodigen } from "./PortalUitnodigen";
import { Button } from "@/components/ui/button";

type Ond = { id: string; naam: string | null; rechtsvorm?: string | null; kvk?: string | null; iban?: string | null; exact_relatie_code?: string | null };
type Pers = { id: string; voornaam?: string | null; achternaam?: string | null; email_weergave?: string | null };

const CREDIT_OPEN: Record<string, string> = { te_maken: "creditnota gepland, nog niet in Exact", geblokkeerd: "creditnota geblokkeerd", fout: "creditnota fout" };
const tel = (t: string) => t.replace(/[^\d+]/g, "");

/** Klantkaart bovenaan onderneming- en persoonspagina: alles wat je nodig hebt als een klant belt. */
export function KlantKaart({ ondernemingen, personen, leadIds, herlaadSleutel = 0, onGewijzigd }: { ondernemingen: Ond[]; personen: Pers[]; leadIds: string[]; herlaadSleutel?: number; onGewijzigd?: () => void }) {
  const ondIds = ondernemingen.map((o) => o.id);
  const persIds = personen.map((p) => p.id);
  const bav = useBavRijen(ondIds, leadIds);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["klantkaart", ondIds.join(","), persIds.join(","), leadIds.join(","), herlaadSleutel],
    queryFn: async () => {
      const codes = ondernemingen.map((o) => o.exact_relatie_code).filter(Boolean) as string[];
      const [k, l, m, n, a, tk] = await Promise.all([
        ondIds.length ? supabase.from("klant_contracten").select("id,onderneming_id,product,status,begin_datum,eind_datum,gefactureerd_tm,volgende_factuurdatum,bron_rij,cyber_ingangsdatum,cyber_einddatum,cyber_nieuwe_voorwaarden_per").in("onderneming_id", ondIds).order("bron_rij") : Promise.resolve({ data: [] as any[] }),
        leadIds.length ? supabase.from("leads").select("id,email,telefoon,iban,status,gekozen_pakket,ingangsdatum,created_at").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
        codes.length ? (supabase.from as any)("klant_mandaat_v").select("relatiecode,iban").in("relatiecode", codes) : Promise.resolve({ data: [] as any[] }),
        ondIds.length + persIds.length ? supabase.from("crm_notities").select("aangemaakt_op,soort,aangemaakt_door_naam").or([ondIds.length ? `onderneming_id.in.(${ondIds.join(",")})` : "", persIds.length ? `persoon_id.in.(${persIds.join(",")})` : ""].filter(Boolean).join(",")).is("ingetrokken_op", null).order("aangemaakt_op", { ascending: false }).limit(1) : Promise.resolve({ data: [] as any[] }),
        ondIds.length ? supabase.from("klant_service_aanvragen").select("id,type,status,created_at").in("onderneming_id", ondIds).is("gekoppeld_aan", null).in("status", ["nieuw", "in_behandeling"]) : Promise.resolve({ data: [] as any[] }),
        ondIds.length + persIds.length ? (supabase.from as any)("crm_taken").select("id,omschrijving,aangemaakt_op,aangemaakt_door_naam").eq("status", "open").or([ondIds.length ? `onderneming_id.in.(${ondIds.join(",")})` : "", persIds.length ? `persoon_id.in.(${persIds.join(",")})` : ""].filter(Boolean).join(",")) : Promise.resolve({ data: [] as any[] }),
      ]);
      const contracten = (k.data ?? []) as any[];
      const c = contracten.length ? (await supabase.from("factuur_credit_planning").select("id,status,credit_vanaf,credit_tm,klant_contract_id").in("klant_contract_id", contracten.map((x) => x.id)).in("status", Object.keys(CREDIT_OPEN))).data ?? [] : [];
      let laatsteLead: any = null;
      if (leadIds.length) laatsteLead = (await supabase.from("lead_notes").select("created_at,type").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(1)).data?.[0] ?? null;
      return { contracten, leads: (l.data ?? []) as any[], mandaten: (m.data ?? []) as any[], laatsteNotitie: (n.data ?? [])[0] ?? null, laatsteLead, open: (a.data ?? []) as any[], taken: ((tk as any).data ?? []) as any[], credits: c as any[] };
    },
  });

  const leads = data?.leads ?? [];
  const emails = Array.from(new Set([...personen.map((p) => p.email_weergave), ...leads.map((l) => l.email)].filter(Boolean))) as string[];
  const telefoons = Array.from(new Set(leads.map((l) => l.telefoon).filter(Boolean))) as string[];
  const iban = data?.mandaten.find((m) => m.iban)?.iban ?? ondernemingen.find((o) => o.iban)?.iban ?? leads.find((l) => l.iban)?.iban ?? null;
  const laatste = [data?.laatsteNotitie?.aangemaakt_op, data?.laatsteLead?.created_at].filter(Boolean).sort().reverse()[0] as string | undefined;
  const rijen = bav.data ?? [];
  const persoonNaam = personen.map((p) => [p.voornaam, p.achternaam].filter(Boolean).join(" ")).filter(Boolean).join(", ");

  const acties: string[] = [];
  for (const a of data?.open ?? []) acties.push(`${a.type === "opzeggen" ? "Open opzegverzoek" : `Open serviceaanvraag (${a.type})`} van ${formatDateNL(a.created_at)}`);
  for (const c of data?.credits ?? []) acties.push(`${CREDIT_OPEN[c.status]}: ${formatDateNL(c.credit_vanaf)} t/m ${formatDateNL(c.credit_tm)}`);

  return (
    <Card className="min-w-0 border-primary/30">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2"><CardTitle className="text-base">Klantkaart</CardTitle><div className="flex flex-wrap gap-2"><GegevensWijzigen ondernemingen={ondernemingen} personen={personen} onGewijzigd={() => { refetch(); onGewijzigd?.(); }} />{ondernemingen.map((o) => <PortalUitnodigen key={o.id} ondernemingId={o.id} onVerstuurd={onGewijzigd} />)}</div></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>
          <dl className="grid min-w-0 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            <Veld label="Persoon">{persoonNaam || "-"}</Veld>
            <Veld label="Bedrijf">{ondernemingen.map((o) => o.naam).join(", ") || "-"}</Veld>
            <Veld label="Rechtsvorm / KvK">{ondernemingen.map((o) => [o.rechtsvorm, o.kvk ? `KvK ${o.kvk}` : null].filter(Boolean).join(" · ") || "-").join(", ") || "-"}</Veld>
            <Veld label="E-mail">{emails.length ? emails.map((e) => <a key={e} href={`mailto:${e}`} className="mr-2 inline-flex items-center gap-1 break-all text-primary hover:underline"><Mail className="h-3 w-3" />{e}</a>) : "-"}</Veld>
            <Veld label="Telefoon">{telefoons.length ? telefoons.map((t) => <a key={t} href={`tel:${tel(t)}`} className="mr-2 inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{t}</a>) : "-"}</Veld>
            <Veld label="IBAN">{iban ? maskeerIban(iban) : "-"}</Veld>
            <Veld label="Laatste contactmoment">{laatste ? formatDateTimeNL(laatste) : "-"}</Veld>
          </dl>
          <div className="space-y-1">
            {(data?.contracten ?? []).map((c) => {
              const es = contractEindStatus(c);
              const ond = ondernemingen.length > 1 ? ondernemingen.find((o) => o.id === c.onderneming_id)?.naam : null;
              return (
                <div key={c.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border p-2">
                  <span className="font-medium">{PRODUCT_LABEL[c.product as Product] ?? c.product}{ond ? ` (${ond})` : ""}</span>
                  <BavNummer keuze={kiesBavNummer(rijen.filter((r) => !r.onderneming_id || r.onderneming_id === c.onderneming_id), { contractId: c.id })} />
                  <Badge variant={es.soort === "lopend" ? "secondary" : "outline"}>{es.soort === "beeindigd" ? `Beeindigd${es.datum ? ` per ${formatDateNL(es.datum)}` : ""}` : es.soort === "loopt_af" ? `Loopt af per ${formatDateNL(es.datum)}` : "Actief"}</Badge>
                  <span className="text-xs text-muted-foreground">ingang {formatDateNL(c.begin_datum)} · gefactureerd t/m {formatDateNL(c.gefactureerd_tm)}{es.soort === "lopend" ? ` · volgende factuur ${formatDateNL(c.volgende_factuurdatum)}` : ""}</span>
                  {c.product === "cyber_clear" && <CyberDatums contractId={c.id} ingang={c.cyber_ingangsdatum} eind={c.cyber_einddatum} nieuwePer={c.cyber_nieuwe_voorwaarden_per} onGewijzigd={() => refetch()} />}
                </div>);
            })}
            {(data?.contracten ?? []).length === 0 && leads.map((l) => (
              <div key={l.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border p-2">
                <Link to={`/admin/leads/${l.id}`} className="font-medium hover:text-primary">{l.gekozen_pakket ?? "Aanvraag"}</Link>
                <BavNummer keuze={kiesBavNummer(rijen.filter((r) => r.lead_id === l.id || r.bron !== "zp"))} />
                <Badge variant="secondary">{l.status}</Badge>
                <span className="text-xs text-muted-foreground">ingang {formatDateNL(l.ingangsdatum)}</span>
              </div>))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Openstaande acties</p>
            {acties.length ? <ul className="list-disc pl-5">{acties.map((a) => <li key={a}>{a}</li>)}</ul> : !(data?.taken ?? []).length && <p className="text-muted-foreground">Geen</p>}
            {(data?.taken ?? []).map((t: any) => (
              <div key={t.id} className="mt-1 flex flex-wrap items-center gap-2 rounded border border-amber-300 p-2">
                <span className="min-w-0 flex-1">Taak Roxy: {t.omschrijving} <span className="text-xs text-muted-foreground">({t.aangemaakt_door_naam}, {formatDateNL(t.aangemaakt_op)})</span></span>
                <Button size="sm" variant="outline" onClick={async () => { const { error } = await (supabase.rpc as any)("crm_taak_afronden", { _id: t.id }); if (!error) refetch(); }}>Gedaan</Button>
              </div>))}
          </div>
        </>)}
      </CardContent>
    </Card>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}
