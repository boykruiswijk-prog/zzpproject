import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Euro, Users, TrendingUp, UserX, CalendarClock, AlertTriangle, RefreshCw, LineChart, Target, Inbox } from "lucide-react";
import { formatEuro } from "@/lib/klantContracten";
import { NETTO_GROEI_LABEL } from "@/lib/nettoGroei";
import { ArrOverzicht } from "@/components/admin/ArrOverzicht";
import { NpsOverzicht } from "@/components/admin/NpsOverzicht";
import { controleerDashboardOpbouw, controleerLeadsOpbouw, conversieAanvragen, type AanvragenOpbouw, type InstroomOpbouw } from "../../../supabase/functions/_shared/dashboardOpbouw";

export type DashboardTellers = {
  klanten: number; contracten_actief: number; mrr: number; arr: number;
  leads_totaal: number; leads_week: number; leads_maand: number; leads_omgezet: number;
  opzeggingen_te_koppelen: number; opzeggingen_te_verwerken: number;
  /** Planning-velden zijn null voor teamleden zonder supervisor/admin-rechten. */
  planning_aantal: number | null; planning_bedrag: number | null;
  planning_factureerbaar_aantal: number | null; planning_factureerbaar_bedrag: number | null;
  planning_geblokkeerd_aantal: number | null;
  /** Uit tel_service_open / tel_aanvragen_doel: dezelfde definitie als het live-scherm. */
  service_open?: number; aanvragen_doel?: number; aanvragen_doel_van?: number;
  aanvragen_opbouw?: AanvragenOpbouw;
  leads_opbouw?: { vanaf: string; totaal: number; aanvragen: number; contact: number; offerte: number; handmatig?: number; handmatige_bronnen?: Record<string, number> };
  /** Uit tel_netto_groei: zelfde bron als het live-scherm (A6). Alleen aantallen. */
  netto_groei?: { instroom_opbouw?: InstroomOpbouw; cumulatief?: { instroom: number; beeindigingen: number; netto_groei: number; opzegpercentage: number | null; circle8_opzeggingen: number } };
};

/** Eén bron voor alle dashboardtellers: RPC dashboard_tellers (CRM). */
export function useDashboardTellers() {
  const { toonTest } = useToonTestrecords();
  return useQuery({
    queryKey: ["dashboard-tellers", toonTest],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_tellers", { _toon_test: toonTest });
      if (error) {
        console.error("dashboard_tellers mislukt:", error);
        throw new Error(error.message || "Onbekende fout");
      }
      if (!data || typeof data !== "object") throw new Error("Lege reactie van de tellers");
      const tellers = data as unknown as DashboardTellers;
      controleerDashboardOpbouw(tellers.aanvragen_opbouw, tellers.aanvragen_doel);
      controleerLeadsOpbouw(tellers.leads_opbouw);
      return tellers;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function DashboardStats() {
  const { data: t, isLoading, isError, error, refetch, isFetching } = useDashboardTellers();

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Tellers konden niet worden geladen</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{(error as Error)?.message}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Opnieuw proberen
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const a = t?.aanvragen_opbouw;
  const l = t?.leads_opbouw;
  const i = t?.netto_groei?.instroom_opbouw;
  const conversie = conversieAanvragen(a);
  const kaarten = [
    { title: "Klanten", value: t?.klanten, icon: Building2, description: "Ondernemingen met een lopend contract", href: "/admin/klanten" },
    { title: "Actieve contractregels", value: t?.contracten_actief, icon: FileText, description: "Status actief of loopt af", href: "/admin/klanten" },
    { title: "Maandwaarde (MRR)", value: t ? formatEuro(t.mrr) : undefined, icon: Euro, description: "Jaarcontracten gedeeld door 12", href: "/admin/klanten" },
    { title: "Jaarwaarde (ARR)", value: t ? formatEuro(t.arr) : undefined, icon: LineChart, description: "MRR × 12", href: "/admin/klanten" },
    { title: "Leads", value: l?.totaal ?? t?.leads_totaal, icon: Users, description: l ? `${l.aanvragen} aanvragen · ${l.contact} contact · ${l.offerte} offerte · handmatig ${l.handmatig ?? 0}${Object.entries(l.handmatige_bronnen ?? {}).length ? ` (${Object.entries(l.handmatige_bronnen ?? {}).map(([bron,n]) => `${bron} ${n}`).join(", ")})` : ""} · sinds ${new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(`${l.vanaf}T12:00:00Z`))} t/m vandaag · zonder test` : "Alle ontvangen leads, zonder test", href: "/admin/leads" },
    { title: "Conversie aanvragen sinds 6 okt", value: a ? `${conversie.toLocaleString("nl-NL")}%` : undefined, icon: TrendingUp, description: a ? `${a.klant} van ${a.totaal} aanvragen klant · ${a.in_behandeling} in behandeling · ${a.te_beoordelen} te beoordelen · ${a.overig} afgewezen/overig · zelfde getal als het live-scherm` : "Zelfde aanvraagset als de doeltegel", href: "/admin/aanvragen" },
    { title: "Aanvragen BAV + AVB sinds 6 okt", value: t ? `${t.aanvragen_doel ?? 0} van ${t.aanvragen_doel_van ?? 200}` : undefined, icon: Target, description: "6 okt t/m 31 dec · ontdubbeld per KvK, zonder test · zelfde getal als het live-scherm", href: "/admin/aanvragen" },
    { title: `Netto groei ${NETTO_GROEI_LABEL.toLowerCase()}`, value: t?.netto_groei?.cumulatief ? `${t.netto_groei.cumulatief.netto_groei >= 0 ? "+" : ""}${t.netto_groei.cumulatief.netto_groei}` : undefined, icon: TrendingUp, description: t?.netto_groei?.cumulatief ? `${t.netto_groei.cumulatief.instroom} instroom, ${t.netto_groei.cumulatief.beeindigingen} beëindigd${i ? ` · via aanvraag ${i.via_aanvraag} (waarvan ${i.voor_6_okt} vóór 6 okt aangevraagd) · AFAS-overzetting ${i.afas_overzetting}${i.overig ? ` · overig ${i.overig}` : ""} · nog in te gaan ${i.nog_in_te_gaan} (toekomstige ingangsdatum)` : ""} · zelfde getal als het live-scherm` : "Zelfde getal als het live-scherm", href: "/admin/klanten" },
    { title: "Serviceverzoeken open", value: t?.service_open, icon: Inbox, description: "Zelfde getal als het live-scherm", href: "/admin/service-aanvragen" },
    { title: "Opzeggingen te koppelen", value: t?.opzeggingen_te_koppelen, icon: UserX, description: `${t?.opzeggingen_te_verwerken ?? 0} gekoppeld, nog te verwerken`, href: "/admin/klanten#opzeggingen", let: (t?.opzeggingen_te_koppelen ?? 0) > 0 },
    // Alleen tonen als de planning-velden gevuld zijn (supervisor/admin).
    ...(t?.planning_aantal != null ? [{ title: "Facturatieplanning (30 dagen)", value: `${t.planning_aantal} · ${formatEuro(t.planning_bedrag ?? 0)}`, icon: CalendarClock, description: `${t.planning_factureerbaar_aantal} factureerbaar (${formatEuro(t.planning_factureerbaar_bedrag ?? 0)}) · ${t.planning_geblokkeerd_aantal} geblokkeerd`, href: "/admin/facturatieplanning" }] : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ArrOverzicht />
      <NpsOverzicht />
      {kaarten.map((k) => (
        <Link key={k.title} to={k.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className={`h-full hover:bg-muted/30 ${k.let ? "border-amber-500" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{k.title}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{isLoading ? "…" : k.value ?? "—"}</div>
              <p className="text-xs text-muted-foreground">{k.description}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
