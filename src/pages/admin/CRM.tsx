import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, RotateCw, ChevronDown, ChevronRight, AlertTriangle, Check, Split } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import { useAuth } from "@/contexts/AuthContext";
import { CERT_VELDEN, actueelCertificaat, groepeerPerOnderneming, type KlantCertificaat } from "@/lib/klantCertificaten";
import { statusLabel, statusTitel } from "@/lib/statusLabels";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { fetchAlle } from "@/lib/fetchAlle";
import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";
import { leadOnderwerp } from "../../../supabase/functions/_shared/leadVelden";

type EventType = "lead" | "service" | "screening";
type Beslissing = { genormaliseerd_email: string; beslissing: "akkoord" | "splitsen"; bekende_namen: string[] };

type Event = {
  id: string;
  type: EventType;
  datum: string;
  status: string;
  naam: string;
  omschrijving: string;
  email: string;
  telefoon: string;
  onderwerp: string;
  detailHref: string;
};

type Bedrijf = { bedrijfsnaam: string; kvk: string; id?: string; relatiecode?: string | null; cert?: string | null; certs?: string[] };

type Person = {
  id: string;
  naam: string;
  email: string;
  telefoon: string;
  genormaliseerd_email: string | null;
  bedrijven: Bedrijf[];
  persoonStatus: string;
  events: Event[];
  laatsteDatum: string;
  namenGedeeld: boolean;
};

const TYPE_LABEL: Record<EventType, string> = {
  lead: "Lead",
  service: "Service",
  screening: "Screening",
};

const TYPE_COLOR: Record<EventType, string> = {
  lead: "bg-blue-100 text-blue-800",
  service: "bg-emerald-100 text-emerald-800",
  screening: "bg-purple-100 text-purple-800",
};

const SERVICE_SUBTYPE_LABEL: Record<string, string> = {
  certificaat: "Polis",
  pauzeren: "Pauzeren",
  documenten: "Documenten",
  opzeggen: "Opzeggen",
};

function naamOf(v?: string | null, a?: string | null) {
  return [v, a].filter(Boolean).join(" ").trim();
}

function normalizeNaam(n: string) {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function CRM() {
  const { toast } = useToast();
  const { isSupervisorOrAdmin } = useAuth();
  const [personen, setPersonen] = useState<Person[]>([]);
  const [beslissingen, setBeslissingen] = useState<Record<string, Beslissing>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkFilter, setCheckFilter] = useState(false);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const { toonTest } = useToonTestrecords();

  async function load() {
    setLoading(true);

    const [personenRes, poRes, ondRes, kopRes, leadsRes, serviceRes, screeningRes, beslissingRes, certRes] = await Promise.all([
      fetchAlle((a, b) => supabase.from("personen" as any).select("id,genormaliseerd_email,email_weergave,voornaam,achternaam,is_test").range(a, b)),
      fetchAlle((a, b) => supabase.from("persoon_onderneming" as any).select("persoon_id,onderneming_id").range(a, b)),
      fetchAlle((a, b) => supabase.from("ondernemingen" as any).select("id,kvk,naam,is_test,exact_relatie_code").range(a, b)),
      supabase.from("persoon_bron_koppeling" as any).select("persoon_id,bron_tabel,bron_id"),
      supabase.from("leads").select("id,created_at,voornaam,achternaam,email,telefoon,status,verzekering_type,bedrijfsnaam,opmerkingen,extra_data,is_test"),
      supabase.from("klant_service_aanvragen" as any).select("id,created_at,voornaam,achternaam,email,telefoon,status,type,polisnummer,is_test"),
      supabase.from("screening_aanvragen" as any).select("id,aangemeld_op,voornaam,achternaam,email,telefoon,status,screening_type,bedrijfsnaam,is_test"),
      supabase.from("crm_identiteit_beslissingen" as any).select("genormaliseerd_email,beslissing,bekende_namen"),
      fetchAlle<KlantCertificaat>((a, b) => supabase.from("klant_certificaten" as any).select(CERT_VELDEN).range(a, b)),
    ]);
    const certsPerOnd = groepeerPerOnderneming(certRes.data);

    const errors = [
      personenRes.error, poRes.error, ondRes.error, kopRes.error,
      leadsRes.error, serviceRes.error, screeningRes.error, beslissingRes.error,
    ].filter(Boolean);
    if (errors.length) {
      toast({
        title: "Fout bij laden",
        description: errors.map((e) => e?.message).join(" · "),
        variant: "destructive",
      });
    }

    // Beslissingen map
    const bmap: Record<string, Beslissing> = {};
    for (const b of (beslissingRes.data ?? []) as any[]) {
      bmap[b.genormaliseerd_email] = {
        genormaliseerd_email: b.genormaliseerd_email,
        beslissing: b.beslissing,
        bekende_namen: b.bekende_namen ?? [],
      };
    }
    setBeslissingen(bmap);

    // Ondernemingen lookup
    const ondMap = new Map<string, { kvk: string; naam: string; relatiecode: string | null }>();
    for (const o of (ondRes.data ?? []) as any[]) {
      if (o.is_test && !toonTest) continue;
      ondMap.set(o.id, { kvk: o.kvk ?? "", naam: o.naam ?? "", relatiecode: o.exact_relatie_code ?? null });
    }

    // Bedrijven per persoon
    const bedrijvenPerPersoon = new Map<string, Bedrijf[]>();
    for (const po of (poRes.data ?? []) as any[]) {
      const o = ondMap.get(po.onderneming_id);
      if (!o) continue;
      const arr = bedrijvenPerPersoon.get(po.persoon_id) ?? [];
      if (!arr.some((b) => b.bedrijfsnaam === o.naam && b.kvk === o.kvk)) {
        const cs = certsPerOnd.get(po.onderneming_id) ?? [];
        arr.push({ bedrijfsnaam: o.naam, kvk: o.kvk, id: po.onderneming_id, relatiecode: o.relatiecode,
          cert: actueelCertificaat(cs)?.certificaatnummer ?? null,
          certs: cs.filter((c) => c.koppeling_status !== "afgewezen").map((c) => c.certificaatnummer) });
      }
      bedrijvenPerPersoon.set(po.persoon_id, arr);
    }

    // Bronrecord lookups
    const leadsMap = new Map<string, any>();
    for (const l of (leadsRes.data ?? []) as any[]) if (toonTest || !l.is_test) leadsMap.set(l.id, l);
    const serviceMap = new Map<string, any>();
    for (const s of (serviceRes.data ?? []) as any[]) if (toonTest || !s.is_test) serviceMap.set(s.id, s);
    const screeningMap = new Map<string, any>();
    for (const s of (screeningRes.data ?? []) as any[]) if (toonTest || !s.is_test) screeningMap.set(s.id, s);

    // Events per persoon via persoon_bron_koppeling
    const eventsPerPersoon = new Map<string, Event[]>();
    let unlinked = 0;
    const gekoppeldeIds = { leads: new Set<string>(), service: new Set<string>(), screening: new Set<string>() };

    for (const k of (kopRes.data ?? []) as any[]) {
      const bron = k.bron_tabel as "leads" | "service" | "screening";
      const bronId = k.bron_id as string;
      gekoppeldeIds[bron].add(bronId);
      let ev: Event | null = null;
      if (bron === "leads") {
        const l = leadsMap.get(bronId);
        if (l) {
          ev = {
            id: l.id,
            type: "lead",
            datum: l.created_at,
            status: l.status ?? "",
            naam: naamOf(l.voornaam, l.achternaam),
            omschrijving: [l.verzekering_type, l.bedrijfsnaam].filter(Boolean).join(" · ") || "Nieuwe lead",
            email: l.email ?? "",
            telefoon: l.telefoon ?? "",
            onderwerp: leadOnderwerp(l),
            detailHref: `/admin/leads/${l.id}`,
          };
        }
      } else if (bron === "service") {
        const s = serviceMap.get(bronId);
        if (s) {
          ev = {
            id: s.id,
            type: "service",
            datum: s.created_at,
            status: s.status ?? "",
            naam: naamOf(s.voornaam, s.achternaam),
            omschrijving: [SERVICE_SUBTYPE_LABEL[s.type] ?? s.type, s.polisnummer].filter(Boolean).join(" · "),
            email: s.email ?? "",
            telefoon: s.telefoon ?? "",
            onderwerp: "",
            detailHref: `/admin/service-aanvragen/${s.id}`,
          };
        }
      } else if (bron === "screening") {
        const s = screeningMap.get(bronId);
        if (s) {
          ev = {
            id: s.id,
            type: "screening",
            datum: s.aangemeld_op,
            status: s.status ?? "",
            naam: naamOf(s.voornaam, s.achternaam),
            omschrijving: [s.screening_type, s.bedrijfsnaam].filter(Boolean).join(" · ") || "Screeningaanvraag",
            email: s.email ?? "",
            telefoon: s.telefoon ?? "",
            onderwerp: "",
            detailHref: `/admin/screening-aanvragen/${s.id}`,
          };
        }
      }
      if (ev) {
        const arr = eventsPerPersoon.get(k.persoon_id) ?? [];
        arr.push(ev);
        eventsPerPersoon.set(k.persoon_id, arr);
      }
    }

    // Detect unlinked source records (arrived after backfill or never linked)
    for (const id of leadsMap.keys()) if (!gekoppeldeIds.leads.has(id)) unlinked++;
    for (const id of serviceMap.keys()) if (!gekoppeldeIds.service.has(id)) unlinked++;
    for (const id of screeningMap.keys()) if (!gekoppeldeIds.screening.has(id)) unlinked++;
    setUnlinkedCount(unlinked);

    // Build persons
    const persons: Person[] = ((personenRes.data ?? []) as any[]).filter((p) => toonTest || !p.is_test).map((p) => {
      const events = (eventsPerPersoon.get(p.id) ?? []).sort(
        (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime(),
      );
      const laatsteDatum = events[0]?.datum ?? "";
      const heeftActief = events.some((e) => e.type === "lead" && e.status === "actief");
      const persoonStatus = heeftActief ? "actief" : events[0]?.status ?? "";

      const naamUitPersoon = naamOf(p.voornaam, p.achternaam);
      const naamUitEvent = events.find((e) => e.naam)?.naam ?? "";
      const naam = naamUitPersoon || naamUitEvent || "—";
      const telefoon = events.find((e) => e.telefoon)?.telefoon ?? "";

      // Namen-gedeeld marker: alleen zinvol wanneer beslissing niet 'splitsen' is
      const emailKey = p.genormaliseerd_email as string | null;
      const beslissing = emailKey ? bmap[emailKey] : undefined;
      let namenGedeeld = false;
      if (emailKey && beslissing?.beslissing !== "splitsen") {
        const huidigeNamen = Array.from(
          new Set(events.map((e) => normalizeNaam(e.naam)).filter(Boolean)),
        );
        if (beslissing?.beslissing === "akkoord") {
          const bekend = new Set((beslissing.bekende_namen ?? []).map(normalizeNaam));
          namenGedeeld = huidigeNamen.some((n) => !bekend.has(n));
        } else {
          namenGedeeld = huidigeNamen.length > 1;
        }
      }

      return {
        id: p.id,
        naam,
        email: p.email_weergave ?? "",
        telefoon,
        genormaliseerd_email: emailKey,
        bedrijven: bedrijvenPerPersoon.get(p.id) ?? [],
        persoonStatus,
        events,
        laatsteDatum,
        namenGedeeld,
      };
    });

    persons.sort((a, b) => new Date(b.laatsteDatum || 0).getTime() - new Date(a.laatsteDatum || 0).getTime());
    setPersonen(persons);
    setLoading(false);
  }

  useEffect(() => { load(); }, [toonTest]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    personen.forEach((p) => p.persoonStatus && set.add(p.persoonStatus));
    return Array.from(set).sort();
  }, [personen]);

  const filtered = personen.filter((p) => {
    if (checkFilter && !(p.namenGedeeld || !p.email)) return false;
    if (typeFilter !== "alle" && !p.events.some((e) => e.type === typeFilter)) return false;
    if (statusFilter !== "alle" && p.persoonStatus !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = [
        p.naam,
        p.email,
        p.telefoon,
        ...p.events.flatMap((e) => [e.onderwerp, e.omschrijving]),
        ...p.bedrijven.flatMap((b) => [b.bedrijfsnaam, b.kvk, ...(b.certs ?? [])]),
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function beslis(person: Person, beslissing: "akkoord" | "splitsen") {
    const email = person.genormaliseerd_email;
    if (!email) return;
    const bekende_namen = Array.from(
      new Set(person.events.map((e) => e.naam).filter(Boolean)),
    );
    const { error } = await supabase
      .from("crm_identiteit_beslissingen" as any)
      .upsert(
        { genormaliseerd_email: email, beslissing, bekende_namen, beslist_door: (await supabase.auth.getUser()).data.user?.id, beslist_op: new Date().toISOString() },
        { onConflict: "genormaliseerd_email" },
      );
    if (error) {
      toast({ title: "Kon beslissing niet opslaan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: beslissing === "akkoord" ? "Samengevoegd" : "Gesplitst" });
    setBeslissingen((prev) => ({
      ...prev,
      [email]: { genormaliseerd_email: email, beslissing, bekende_namen },
    }));
    // Refresh markers on-screen without reloading everything
    setPersonen((prev) => prev.map((p) => {
      if (p.genormaliseerd_email !== email) return p;
      let namenGedeeld = false;
      if (beslissing !== "splitsen") {
        const huidigeNamen = Array.from(new Set(p.events.map((e) => normalizeNaam(e.naam)).filter(Boolean)));
        const bekend = new Set(bekende_namen.map(normalizeNaam));
        namenGedeeld = huidigeNamen.some((n) => !bekend.has(n));
      }
      return { ...p, namenGedeeld };
    }));
  }

  return (
    <AdminLayout>
      <div className="min-w-0 space-y-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 break-words text-2xl font-bold sm:text-3xl">
              <Users className="h-7 w-7 text-primary" /> CRM
            </h1>
            <p className="text-muted-foreground">
              Alle leads, service-aanvragen en screeningen gegroepeerd per persoon
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
          <ToonTestrecordsSchakelaar />
          <Button variant="outline" onClick={load}>
            <RotateCw className="h-4 w-4 mr-2" />Herladen
          </Button>
          </div>
        </div>

        {unlinkedCount > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>{unlinkedCount}</strong> bronrecord(s) zijn nog niet gekoppeld aan een persoon in de nieuwe persoonslaag.
              Deze verschijnen daarom (nog) niet in dit overzicht.
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle types</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="screening">Screening</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statussen</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Zoek op naam, email, KvK of certificaat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button
            variant={checkFilter ? "default" : "outline"}
            onClick={() => setCheckFilter((v) => !v)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Te controleren
          </Button>
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">Laden…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">Geen contacten</div>
          ) : filtered.map((p) => {
            const laatsteLead = p.events.find((e) => e.type === "lead");
            const eerste = p.bedrijven[0];
            return (
              <div key={p.id} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{p.naam}</p>
                    {eerste?.bedrijfsnaam && <p className="break-words text-sm text-muted-foreground">{eerste.bedrijfsnaam}</p>}
                  </div>
                  <Badge variant="secondary" className="max-w-[9rem] shrink-0" title={statusTitel(p.persoonStatus) ?? statusLabel(p.persoonStatus)}><span className="truncate">{statusLabel(p.persoonStatus)}</span></Badge>
                </div>
                <div className="min-w-0 space-y-1 text-sm">
                  {p.email ? <a href={`mailto:${p.email}`} className="block break-all text-primary hover:underline">{p.email}</a> : <span className="text-amber-600">Geen emailadres</span>}
                  {p.telefoon && <a href={`tel:${p.telefoon.replace(/[^\d+]/g, "")}`} className="block break-all text-primary hover:underline">{p.telefoon}</a>}
                  {laatsteLead?.onderwerp && <p className="line-clamp-2 break-words text-muted-foreground">{laatsteLead.onderwerp}</p>}
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  {p.events.map((ev) => (
                    <Link key={`${ev.type}-${ev.id}`} to={ev.detailHref} className="block min-w-0 rounded-md bg-muted/40 p-3 hover:bg-muted">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`${TYPE_COLOR[ev.type]} shrink-0`}>{TYPE_LABEL[ev.type]}</Badge>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateNL(ev.datum)}</span>
                      </div>
                      <p className="mt-2 break-words text-sm font-medium">{ev.onderwerp || ev.omschrijving || "—"}</p>
                      {ev.onderwerp && ev.omschrijving && <p className="mt-1 break-words text-xs text-muted-foreground">{ev.omschrijving}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden bg-card border border-border rounded-lg overflow-x-auto md:block">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-[22%]" />
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[132px]" />
              <col className="w-[104px]" />
              <col className="w-[112px]" />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3"></th>
                <th className="text-left p-3">Naam</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Onderneming</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3 truncate" title="Gebeurtenissen">Gebeurt.</th>
                <th className="text-left p-3">Laatste</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Laden…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Geen contacten</td></tr>
              ) : filtered.map((p) => {
                const isOpen = !!expanded[p.id];
                const eerste = p.bedrijven[0];
                return (
                  <Fragment key={p.id}>
                    <tr
                      className="border-t border-border hover:bg-muted/30 cursor-pointer align-top"
                      onClick={() => toggle(p.id)}
                    >
                      <td className="p-3">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="p-3 font-medium min-w-0">
                        <div className="truncate" title={p.naam}>{p.naam}</div>
                        {p.namenGedeeld && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded max-w-full">
                              <AlertTriangle className="h-3 w-3 shrink-0" /> <span className="truncate">Gedeeld adres, controleren</span>
                            </span>
                            {isSupervisorOrAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={(e) => { e.stopPropagation(); beslis(p, "akkoord"); }}
                                >
                                  <Check className="h-3 w-3 mr-1" /> Zelfde persoon
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={(e) => { e.stopPropagation(); beslis(p, "splitsen"); }}
                                >
                                  <Split className="h-3 w-3 mr-1" /> Splitsen
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground min-w-0">
                        {p.email ? (
                          <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="block truncate text-primary hover:underline" title={p.email}>{p.email}</a>
                        ) : (
                          <span className="text-amber-600 font-medium text-xs">Geen emailadres</span>
                        )}
                        {p.telefoon && <a href={`tel:${p.telefoon.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className="block truncate text-primary hover:underline" title={p.telefoon}>{p.telefoon}</a>}
                        {p.events.find((e) => e.type === "lead" && e.onderwerp)?.onderwerp && (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={p.events.find((e) => e.type === "lead" && e.onderwerp)?.onderwerp}>
                            {p.events.find((e) => e.type === "lead" && e.onderwerp)?.onderwerp}
                          </div>
                        )}
                      </td>
                      <td className="p-3 min-w-0">
                        {eerste ? (
                          <div className="min-w-0">
                            {eerste.id ? (
                              <Link to={`/admin/klanten/${eerste.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:text-primary" title={eerste.bedrijfsnaam}>{eerste.bedrijfsnaam || "—"}</Link>
                            ) : <div className="truncate" title={eerste.bedrijfsnaam}>{eerste.bedrijfsnaam || "—"}</div>}
                            {eerste.kvk && <div className="text-xs text-muted-foreground truncate">KvK {eerste.kvk}</div>}
                            {eerste.cert && <div className="text-xs text-muted-foreground truncate tabular-nums" title="Actueel certificaat">Certificaat {eerste.cert}</div>}
                            {eerste.relatiecode && <Badge variant="outline" className="text-xs">Klant</Badge>}
                            {p.bedrijven.length > 1 && (
                              <div className="text-xs text-muted-foreground">+{p.bedrijven.length - 1} meer</div>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="p-3 min-w-0">
                        <Badge variant="secondary" className="max-w-full" title={statusTitel(p.persoonStatus) ?? statusLabel(p.persoonStatus)}>
                          <span className="truncate">{statusLabel(p.persoonStatus)}</span>
                        </Badge>
                      </td>
                      <td className="p-3 tabular-nums">{p.events.length}</td>
                      <td className="p-3 whitespace-nowrap tabular-nums text-muted-foreground">{p.laatsteDatum ? formatDateNL(p.laatsteDatum) : "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr key={p.id + "-detail"} className="bg-muted/20 border-t border-border">
                        <td></td>
                        <td colSpan={6} className="p-4 space-y-4 min-w-0">
                          {p.bedrijven.length > 0 && (
                            <div>
                              <div className="text-xs uppercase text-muted-foreground mb-1">Ondernemingen</div>
                              <ul className="text-sm space-y-0.5">
                                {p.bedrijven.map((b, i) => (
                                  <li key={i} className="truncate" title={[b.bedrijfsnaam, b.kvk && `KvK ${b.kvk}`].filter(Boolean).join(" · ")}>
                                    {b.id ? <Link to={`/admin/klanten/${b.id}`} className="font-medium hover:text-primary">{b.bedrijfsnaam || "—"}</Link> : (b.bedrijfsnaam || "—")}
                                    {b.kvk && <span className="text-muted-foreground"> · KvK {b.kvk}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div>
                            <div className="text-xs uppercase text-muted-foreground mb-2">Tijdlijn</div>
                            <ul className="space-y-1.5">
                              {p.events.map((ev) => (
                                <li key={`${ev.type}-${ev.id}`} className="flex items-center gap-3 text-sm min-w-0">
                                  <span className="text-muted-foreground whitespace-nowrap tabular-nums w-24 shrink-0">
                                    {formatDateNL(ev.datum)}
                                  </span>
                                  <Badge className={`${TYPE_COLOR[ev.type]} shrink-0`}>{TYPE_LABEL[ev.type]}</Badge>
                                  <Link to={ev.detailHref} className="flex-1 min-w-0 truncate hover:underline" title={ev.onderwerp || ev.omschrijving}>
                                    {ev.onderwerp || ev.omschrijving || "—"}
                                  </Link>
                                  <Badge variant="secondary" className="shrink-0 max-w-[160px]" title={statusTitel(ev.status) ?? statusLabel(ev.status)}>
                                    <span className="truncate">{statusLabel(ev.status)}</span>
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
