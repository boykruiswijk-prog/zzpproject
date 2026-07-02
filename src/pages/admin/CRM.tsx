import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type EventType = "lead" | "service" | "screening";
type Beslissing = { genormaliseerd_email: string; beslissing: "akkoord" | "splitsen"; bekende_namen: string[] };

type Event = {
  id: string;
  type: EventType;
  datum: string;
  status: string;
  naam: string;
  omschrijving: string;
  detailHref: string;
};

type Bedrijf = { bedrijfsnaam: string; kvk: string };

type Person = {
  id: string;
  naam: string;
  email: string;
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
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkFilter, setCheckFilter] = useState(false);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  async function load() {
    setLoading(true);

    const [personenRes, poRes, ondRes, kopRes, leadsRes, serviceRes, screeningRes, beslissingRes] = await Promise.all([
      supabase.from("personen" as any).select("id,genormaliseerd_email,email_weergave,voornaam,achternaam"),
      supabase.from("persoon_onderneming" as any).select("persoon_id,onderneming_id"),
      supabase.from("ondernemingen" as any).select("id,kvk,naam"),
      supabase.from("persoon_bron_koppeling" as any).select("persoon_id,bron_tabel,bron_id"),
      supabase.from("leads").select("id,created_at,voornaam,achternaam,status,verzekering_type,bedrijfsnaam"),
      supabase.from("klant_service_aanvragen" as any).select("id,created_at,voornaam,achternaam,status,type,polisnummer"),
      supabase.from("screening_aanvragen" as any).select("id,aangemeld_op,voornaam,achternaam,status,screening_type,bedrijfsnaam"),
      supabase.from("crm_identiteit_beslissingen" as any).select("genormaliseerd_email,beslissing,bekende_namen"),
    ]);

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
    const ondMap = new Map<string, { kvk: string; naam: string }>();
    for (const o of (ondRes.data ?? []) as any[]) {
      ondMap.set(o.id, { kvk: o.kvk ?? "", naam: o.naam ?? "" });
    }

    // Bedrijven per persoon
    const bedrijvenPerPersoon = new Map<string, Bedrijf[]>();
    for (const po of (poRes.data ?? []) as any[]) {
      const o = ondMap.get(po.onderneming_id);
      if (!o) continue;
      const arr = bedrijvenPerPersoon.get(po.persoon_id) ?? [];
      if (!arr.some((b) => b.bedrijfsnaam === o.naam && b.kvk === o.kvk)) {
        arr.push({ bedrijfsnaam: o.naam, kvk: o.kvk });
      }
      bedrijvenPerPersoon.set(po.persoon_id, arr);
    }

    // Bronrecord lookups
    const leadsMap = new Map<string, any>();
    for (const l of (leadsRes.data ?? []) as any[]) leadsMap.set(l.id, l);
    const serviceMap = new Map<string, any>();
    for (const s of (serviceRes.data ?? []) as any[]) serviceMap.set(s.id, s);
    const screeningMap = new Map<string, any>();
    for (const s of (screeningRes.data ?? []) as any[]) screeningMap.set(s.id, s);

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
    const persons: Person[] = ((personenRes.data ?? []) as any[]).map((p) => {
      const events = (eventsPerPersoon.get(p.id) ?? []).sort(
        (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime(),
      );
      const laatsteDatum = events[0]?.datum ?? "";
      const heeftActief = events.some((e) => e.type === "lead" && e.status === "actief");
      const persoonStatus = heeftActief ? "actief" : events[0]?.status ?? "";

      const naamUitPersoon = naamOf(p.voornaam, p.achternaam);
      const naamUitEvent = events.find((e) => e.naam)?.naam ?? "";
      const naam = naamUitPersoon || naamUitEvent || "—";

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

  useEffect(() => { load(); }, []);

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
        ...p.bedrijven.flatMap((b) => [b.bedrijfsnaam, b.kvk]),
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" /> CRM
            </h1>
            <p className="text-muted-foreground">
              Alle leads, service-aanvragen en screeningen gegroepeerd per persoon
            </p>
          </div>
          <Button variant="outline" onClick={load}>
            <RotateCw className="h-4 w-4 mr-2" />Herladen
          </Button>
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
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Zoek op naam, email of KvK"
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

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8 p-3"></th>
                <th className="text-left p-3">Naam</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Onderneming</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Gebeurtenissen</th>
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
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggle(p.id)}
                    >
                      <td className="p-3">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.naam}
                          {p.namenGedeeld && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              <AlertTriangle className="h-3 w-3" /> Gedeeld adres, controleren
                            </span>
                          )}
                          {p.namenGedeeld && isSupervisorOrAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={(e) => { e.stopPropagation(); beslis(p, "akkoord"); }}
                              >
                                <Check className="h-3 w-3 mr-1" /> Akkoord, zelfde persoon
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
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {p.email || (
                          <span className="text-amber-600 font-medium text-xs">Geen emailadres</span>
                        )}
                      </td>
                      <td className="p-3">
                        {eerste ? (
                          <div>
                            <div>{eerste.bedrijfsnaam || "—"}</div>
                            {eerste.kvk && <div className="text-xs text-muted-foreground">KvK {eerste.kvk}</div>}
                            {p.bedrijven.length > 1 && (
                              <div className="text-xs text-muted-foreground">+{p.bedrijven.length - 1} meer</div>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="p-3"><Badge variant="secondary">{p.persoonStatus || "—"}</Badge></td>
                      <td className="p-3">{p.events.length}</td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{p.laatsteDatum ? formatDateNL(p.laatsteDatum) : "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr key={p.id + "-detail"} className="bg-muted/20 border-t border-border">
                        <td></td>
                        <td colSpan={6} className="p-4 space-y-4">
                          {p.bedrijven.length > 0 && (
                            <div>
                              <div className="text-xs uppercase text-muted-foreground mb-1">Ondernemingen</div>
                              <ul className="text-sm space-y-0.5">
                                {p.bedrijven.map((b, i) => (
                                  <li key={i}>
                                    {b.bedrijfsnaam || "—"}
                                    {b.kvk && <span className="text-muted-foreground"> · KvK {b.kvk}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div>
                            <div className="text-xs uppercase text-muted-foreground mb-2">Tijdlijn</div>
                            <ul className="space-y-1">
                              {p.events.map((ev) => (
                                <li key={`${ev.type}-${ev.id}`} className="flex items-center gap-3 text-sm">
                                  <span className="text-muted-foreground whitespace-nowrap w-24">
                                    {formatDateNL(ev.datum)}
                                  </span>
                                  <Badge className={TYPE_COLOR[ev.type]}>{TYPE_LABEL[ev.type]}</Badge>
                                  <Link to={ev.detailHref} className="flex-1 hover:underline">
                                    {ev.omschrijving || "—"}
                                  </Link>
                                  <Badge variant="secondary">{ev.status || "—"}</Badge>
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
