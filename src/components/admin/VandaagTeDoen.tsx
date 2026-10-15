import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flag, AlertTriangle, CalendarClock, ChevronDown, FileWarning, Inbox, MessageCircle, PhoneCall, RefreshCw, ShieldCheck, UserSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { cn } from "@/lib/utils";
import { haalBavRijen, kiesBavNummer } from "@/lib/bavNummer";
import { ServiceAanvraagOog } from "@/components/admin/ServiceAanvraagOog";
import { useToast } from "@/hooks/use-toast";

/** Haalt alleen de status en het factuurnummer op uit Exact (nooit schrijven in Exact) en sluit verwerkte facturen af. */
function NuControlerenMetExact({ onKlaar }: { onKlaar: () => void }) {
  const { toast } = useToast();
  const [bezig, setBezig] = useState(false);
  async function controleer() {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("exact-concept-controle", { body: { actie: "controle", alleen_status: true } });
    setBezig(false);
    if (error || (data as any)?.error) return toast({ title: "Controle met Exact mislukt", description: error?.message ?? String((data as any)?.error), variant: "destructive" });
    const n = ((data as any)?.afgesloten ?? []).length;
    toast({ title: "Gecontroleerd met Exact", description: n ? `${n} factuur/facturen verwerkt in Exact en afgesloten.` : "Geen nieuwe verwerkte facturen gevonden." });
    onKlaar();
  }
  return (
    <Button size="sm" variant="outline" onClick={controleer} disabled={bezig}>
      <RefreshCw className={cn("h-4 w-4", bezig && "animate-spin")} /> Nu controleren met Exact
    </Button>
  );
}

const euroNL = (n: number) => `€ ${Number(n).toFixed(2).replace(".", ",")}`;

/** D9: knop voor beltaak afronden of royement bevestigen (royement zet alleen een status, nooit automatisch). */
function TaakKnop({ label, rpc, args, onKlaar }: { label: string; rpc: string; args: Record<string, unknown>; onKlaar: () => void }) {
  const { toast } = useToast();
  const [bezig, setBezig] = useState(false);
  async function klik() {
    if (rpc === "bevestig_royement" && !window.confirm("Royement bevestigen? Dit zet alleen de status; contract en Exact blijven ongewijzigd.")) return;
    setBezig(true);
    const { error } = await supabase.rpc(rpc as any, args as any);
    setBezig(false);
    if (error) return toast({ title: "Niet gelukt", description: error.message, variant: "destructive" });
    toast({ title: label === "Afronden" ? "Taak afgerond" : "Royement bevestigd" });
    onKlaar();
  }
  return <Button size="sm" variant="outline" onClick={klik} disabled={bezig}>{label}</Button>;
}

interface Item {
  bron?: string | null; id: string; naam?: string | null; bedrijfsnaam?: string | null; sinds?: string | null; reden?: string | null; eigen?: boolean | null;
  onderneming_id?: string; incasso_id?: string; factuurnummer?: string | null;
  contract_id?: string; abonnement_nr?: string | null; product?: string | null; cyclus?: string | null; bedrag?: number | null; eind_datum?: string | null; volgende_factuurdatum?: string | null;
}
interface Categorie { verborgen?: boolean; aantal: number; items: Item[]; per_type?: Record<string, number>; handmatig?: number }
type Acties = Record<string, Categorie> & { voornaam?: string | null; totaal?: number };

const CATEGORIEEN: { key: string; titel: string; icoon: LucideIcon; link: (i: Item) => string; alles: string }[] = [
  { key: "nieuw", titel: "Nieuwe aanvragen en leads", icoon: Inbox, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/leads" },
  { key: "activeren", titel: "Klaar om te activeren", icoon: ShieldCheck, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/leads" },
  { key: "vlaggen", titel: "Gemarkeerd: vandaag opvolgen", icoon: Flag, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/aanvragen" },
  { key: "klant_vlaggen", titel: "Klant gemarkeerd: vandaag opvolgen", icoon: Flag, link: (i) => `/admin/klanten/${i.id}`, alles: "/admin/klanten" },
  { key: "incasso", titel: "Klant bellen: incasso mislukt", icoon: PhoneCall, link: (i) => `/admin/klanten/${i.onderneming_id}`, alles: "/admin/incassos" },
  { key: "royement", titel: "Royement bevestigen", icoon: AlertTriangle, link: (i) => `/admin/klanten/${i.onderneming_id}`, alles: "/admin/incassos" },
  { key: "starter", titel: "Startertarief controleren", icoon: ShieldCheck, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/leads" },
  { key: "service", titel: "Opzeggingen, pauzes en wijzigingen", icoon: FileWarning, link: (i) => `/admin/service-aanvragen/${i.id}`, alles: "/admin/service-aanvragen" },
  { key: "screening", titel: "Screening-aanvragen", icoon: UserSearch, link: (i) => `/admin/screening-aanvragen/${i.id}`, alles: "/admin/screening-aanvragen" },
  { key: "chat", titel: "Terugbelverzoeken Chat Zeker", icoon: MessageCircle, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/chatgesprekken" },
  { key: "afgehaakt", titel: "Afgehaakte aanvragen (2 dagen)", icoon: PhoneCall, link: () => "/admin/afgehaakt", alles: "/admin/afgehaakt" },
  { key: "polissen", titel: "Polissen die aflopen of gepauzeerd zijn", icoon: CalendarClock, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/leads" },
  { key: "nieuwe_aanvraag", titel: "Nieuwe aanvraag nodig (nieuw KvK-nummer)", icoon: FileWarning, link: (i) => `/admin/klanten/${i.id}`, alles: "/admin/klanten" },
  { key: "facturatie", titel: "Facturatie (Roxy): facturen en Exact-aanpassingen", icoon: AlertTriangle, link: (i) => i.bron === "taak" || i.bron === "planning" ? `/admin/klanten/${i.id}` : `/admin/leads/${i.id}`, alles: "/admin/facturatieplanning" },
  { key: "exact", titel: "Exact-fouten", icoon: AlertTriangle, link: (i) => `/admin/leads/${i.id}`, alles: "/admin/leads" },
];

function groet() {
  const uur = Number(new Intl.DateTimeFormat("nl-NL", { hour: "numeric", hour12: false, timeZone: "Europe/Amsterdam" }).format(new Date()));
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

const datum = (s?: string | null) => (s ? new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }) : "");

export function VandaagTeDoen() {
  const { toonTest } = useToonTestrecords();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["mijn-acties-vandaag", toonTest],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mijn_acties_vandaag", { _toon_test: toonTest });
      if (error) throw new Error(error.message || "Onbekende fout");
      return data as unknown as Acties;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const leadIds = Array.from(new Set(["nieuw", "activeren", "polissen", "exact"].flatMap((k) => ((data?.[k] as Categorie | undefined)?.items ?? []).map((i) => i.id))));
  const { data: bav } = useQuery({
    queryKey: ["vandaag-bav", leadIds.join(",")],
    queryFn: () => haalBavRijen([], leadIds),
    enabled: leadIds.length > 0,
    staleTime: 60_000,
  });
  const bavTekst = (id: string) => {
    const rs = (bav ?? []).filter((r) => r.lead_id === id);
    const k = rs.length ? kiesBavNummer(rs) : null;
    return k?.nummer ? `BAV ${k.nummer}` : "";
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-lg">
          <span className="min-w-0 break-words">
            {groet()}{data?.voornaam ? ` ${data.voornaam}` : ""}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Vandaag te doen: <strong className="tabular-nums text-foreground">{data?.totaal ?? (isLoading ? "…" : 0)}</strong>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span className="min-w-0 break-words">Het takenoverzicht kon niet geladen worden: {(error as Error)?.message}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="h-4 w-4" /> Opnieuw</Button>
          </div>
        ) : (
          CATEGORIEEN.map((c) => {
            const cat = data?.[c.key] as Categorie | undefined;
            const n = cat?.aantal ?? 0;
            if (cat?.verborgen || (c.key === "facturatie" && !cat)) return null;
            const Icoon = c.icoon;
            const uit = open === c.key;
            if (!isLoading && n === 0) {
              return (
                <div key={c.key} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                  <Icoon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{c.titel}</span>
                  <span className="shrink-0 text-xs">Niets open</span>
                </div>
              );
            }
            const extra = c.key === "service" && cat?.per_type
              ? Object.entries(cat.per_type).map(([t, a]) => `${t} ${a}`).join(", ")
              : c.key === "nieuw" && cat?.handmatig ? `${cat.handmatig} handmatige acceptatie` : "";
            return (
              <div key={c.key} className="min-w-0 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setOpen(uit ? null : c.key)}
                  aria-expanded={uit}
                  className="flex w-full min-w-0 items-center gap-3 px-2 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <Icoon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.titel}</span>
                    {extra && <span className="block truncate text-xs text-muted-foreground">{extra}</span>}
                  </span>
                  <Badge className={cn("shrink-0 tabular-nums", n > 0 ? "bg-orange-500 text-white hover:bg-orange-500" : "")} variant="secondary">
                    {isLoading ? "…" : n}
                  </Badge>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", uit && "rotate-180")} aria-hidden="true" />
                </button>
                {uit && cat && (
                  <ul className="border-t border-border">
                    {cat.items.map((i) => (
                      <li key={`${c.key}-${i.contract_id ?? i.id}`} className="flex min-w-0 items-center">
                        <Link to={c.link(i)} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2 text-sm hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{i.naam?.trim() || "Onbekend"}</span>
                            {i.bedrijfsnaam && <span className="text-muted-foreground"> · {i.bedrijfsnaam}</span>}
                            {i.eigen && <Badge variant="outline" className="ml-2 text-[10px]">Aan jou</Badge>}
                          </span>
                          <span className="min-w-0 truncate text-xs text-muted-foreground">{[bavTekst(i.id), i.reden, i.factuurnummer ? `factuur ${i.factuurnummer}` : "", i.factuurnummer && i.bedrag != null ? euroNL(i.bedrag) : "", i.sinds ? datum(i.sinds) : ""].filter(Boolean).join(" · ")}</span>
                        </Link>
                        {c.key === "incasso" && <span className="shrink-0 pr-2"><TaakKnop label="Afronden" rpc="crm_taak_afronden" args={{ _id: i.id }} onKlaar={() => refetch()} /></span>}
                        {c.key === "royement" && i.incasso_id && <span className="shrink-0 pr-2"><TaakKnop label="Royement bevestigen" rpc="bevestig_royement" args={{ _id: i.incasso_id }} onKlaar={async () => { await supabase.rpc("crm_taak_afronden", { _id: i.id }); refetch(); }} /></span>}
                        {c.key === "service" && <span className="shrink-0 pr-2"><ServiceAanvraagOog id={i.id} onGewijzigd={() => refetch()} /></span>}
                      </li>
                    ))}
                    {c.key === "facturatie" && <li className="border-t border-border px-3 py-2"><NuControlerenMetExact onKlaar={() => refetch()} /></li>}
                    {n > cat.items.length && (
                      <li><Link to={c.alles} className="block px-3 py-2 text-xs font-medium text-primary hover:underline">Alle {n} bekijken</Link></li>
                    )}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
