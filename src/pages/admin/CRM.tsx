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
  email: string;
  bedrijfsnaam: string;
  kvk: string;
  omschrijving: string;
  detailHref: string;
};

type Person = {
  key: string; // email lowercase, or `__no-email__:${type}:${id}` for missing email
  naam: string;
  email: string;
  bedrijven: Array<{ bedrijfsnaam: string; kvk: string }>;
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export default function CRM() {
  const { toast } = useToast();
  const { isSupervisorOrAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [beslissingen, setBeslissingen] = useState<Record<string, Beslissing>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkFilter, setCheckFilter] = useState(false);

  async function load() {
    setLoading(true);
    const [leadsRes, serviceRes, screeningRes, beslissingRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id,created_at,voornaam,achternaam,email,status,verzekering_type,bedrijfsnaam,kvk_nummer")
        .order("created_at", { ascending: false }),
      supabase
        .from("klant_service_aanvragen" as any)
        .select("id,created_at,voornaam,achternaam,email,status,type,polisnummer")
        .order("created_at", { ascending: false }),
      supabase
        .from("screening_aanvragen" as any)
        .select("id,aangemeld_op,voornaam,achternaam,email,status,screening_type,bedrijfsnaam,kvk_nummer")
        .order("aangemeld_op", { ascending: false }),
      supabase
        .from("crm_identiteit_beslissingen" as any)
        .select("genormaliseerd_email,beslissing,bekende_namen"),
    ]);

    const errors = [leadsRes.error, serviceRes.error, screeningRes.error, beslissingRes.error].filter(Boolean);
    if (errors.length) {
      toast({
        title: "Fout bij laden",
        description: errors.map((e) => e?.message).join(" · "),
        variant: "destructive",
      });
    }

    const bmap: Record<string, Beslissing> = {};
    for (const b of (beslissingRes.data ?? []) as any[]) {
      bmap[b.genormaliseerd_email] = {
        genormaliseerd_email: b.genormaliseerd_email,
        beslissing: b.beslissing,
        bekende_namen: b.bekende_namen ?? [],
      };
    }
    setBeslissingen(bmap);

    const leadEvents: Event[] = (leadsRes.data ?? []).map((l: any) => ({
      id: l.id,
      type: "lead",
      datum: l.created_at,
      status: l.status ?? "",
      naam: naamOf(l.voornaam, l.achternaam),
      email: l.email ?? "",
      bedrijfsnaam: l.bedrijfsnaam ?? "",
      kvk: l.kvk_nummer ?? "",
      omschrijving: [l.verzekering_type, l.bedrijfsnaam].filter(Boolean).join(" · ") || "Nieuwe lead",
      detailHref: `/admin/leads/${l.id}`,
    }));

    const serviceEvents: Event[] = (serviceRes.data ?? []).map((s: any) => ({
      id: s.id,
      type: "service",
      datum: s.created_at,
      status: s.status ?? "",
      naam: naamOf(s.voornaam, s.achternaam),
      email: s.email ?? "",
      bedrijfsnaam: "",
      kvk: "",
      omschrijving: [SERVICE_SUBTYPE_LABEL[s.type] ?? s.type, s.polisnummer].filter(Boolean).join(" · "),
      detailHref: `/admin/service-aanvragen/${s.id}`,
    }));

    const screeningEvents: Event[] = (screeningRes.data ?? []).map((s: any) => ({
      id: s.id,
      type: "screening",
      datum: s.aangemeld_op,
      status: s.status ?? "",
      naam: naamOf(s.voornaam, s.achternaam),
      email: s.email ?? "",
      bedrijfsnaam: s.bedrijfsnaam ?? "",
      kvk: s.kvk_nummer ?? "",
      omschrijving: [s.screening_type, s.bedrijfsnaam].filter(Boolean).join(" · ") || "Screeningaanvraag",
      detailHref: `/admin/screening-aanvragen/${s.id}`,
    }));

    setEvents([...leadEvents, ...serviceEvents, ...screeningEvents]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Group by email, respecting saved identity decisions.
  const personen: Person[] = useMemo(() => {
    const map = new Map<string, Person>();
    for (const ev of events) {
      const keyEmail = normalizeEmail(ev.email);
      const hasEmail = !!keyEmail;
      const beslissing = hasEmail ? beslissingen[keyEmail] : undefined;
      let key: string;
      if (!hasEmail) {
        key = `__no-email__:${ev.type}:${ev.id}`;
      } else if (beslissing?.beslissing === "splitsen") {
        // Split view: group by email + normalized name (fallback to event id if no name)
        const naamKey = normalizeNaam(ev.naam) || `__geen-naam__:${ev.type}:${ev.id}`;
        key = `${keyEmail}|${naamKey}`;
      } else {
        key = keyEmail;
      }
      let p = map.get(key);
      if (!p) {
        p = {
          key,
          naam: ev.naam || "—",
          email: ev.email,
          bedrijven: [],
          persoonStatus: ev.status,
          events: [],
          laatsteDatum: ev.datum,
          namenGedeeld: false,
        };
        map.set(key, p);
      }
      p.events.push(ev);
      if (ev.bedrijfsnaam || ev.kvk) {
        const exists = p.bedrijven.some(
          (b) => b.bedrijfsnaam === ev.bedrijfsnaam && b.kvk === ev.kvk,
        );
        if (!exists) p.bedrijven.push({ bedrijfsnaam: ev.bedrijfsnaam, kvk: ev.kvk });
      }
    }

    const persons = Array.from(map.values());
    for (const p of persons) {
      p.events.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
      p.laatsteDatum = p.events[0]?.datum ?? p.laatsteDatum;

      const naamEv = p.events.find((e) => e.naam);
      if (naamEv) p.naam = naamEv.naam;

      // Marker logic: only if grouped by email (not split, not no-email).
      const emailKey = normalizeEmail(p.email);
      const beslissing = emailKey ? beslissingen[emailKey] : undefined;
      if (emailKey && beslissing?.beslissing !== "splitsen") {
        const huidigeNamen = Array.from(
          new Set(p.events.map((e) => normalizeNaam(e.naam)).filter(Boolean)),
        );
        if (beslissing?.beslissing === "akkoord") {
          const bekend = new Set((beslissing.bekende_namen ?? []).map(normalizeNaam));
          // Re-trigger only if a NEW name appeared since decision
          p.namenGedeeld = huidigeNamen.some((n) => !bekend.has(n));
        } else {
          p.namenGedeeld = huidigeNamen.length > 1;
        }
      } else {
        p.namenGedeeld = false;
      }

      const heeftActief = p.events.some(
        (e) => e.type === "lead" && e.status === "actief",
      );
      p.persoonStatus = heeftActief ? "actief" : p.events[0]?.status ?? "";
    }

    persons.sort(
      (a, b) => new Date(b.laatsteDatum).getTime() - new Date(a.laatsteDatum).getTime(),
    );
    return persons;
  }, [events, beslissingen]);

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
                const isOpen = !!expanded[p.key];
                const eerste = p.bedrijven[0];
                return (
                  <Fragment key={p.key}>
                    <tr
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggle(p.key)}
                    >
                      <td className="p-3">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          {p.naam}
                          {p.namenGedeeld && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              <AlertTriangle className="h-3 w-3" /> Gedeeld adres, controleren
                            </span>
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
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateNL(p.laatsteDatum)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={p.key + "-detail"} className="bg-muted/20 border-t border-border">
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
