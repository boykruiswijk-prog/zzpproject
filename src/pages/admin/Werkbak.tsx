import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Inbox, RotateCw } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";

type WerkbakType = "lead" | "service" | "screening";

type Row = {
  id: string;
  type: WerkbakType;
  datum: string;
  naam: string;
  email: string;
  status: string;
  omschrijving: string;
  detailHref: string;
};

const TYPE_LABEL: Record<WerkbakType, string> = {
  lead: "Lead",
  service: "Service",
  screening: "Screening",
};

const TYPE_COLOR: Record<WerkbakType, string> = {
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
  return [v, a].filter(Boolean).join(" ").trim() || "—";
}

export default function Werkbak() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const [leadsRes, serviceRes, screeningRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id,created_at,voornaam,achternaam,email,status,verzekering_type,bedrijfsnaam")
        .order("created_at", { ascending: false }),
      supabase
        .from("klant_service_aanvragen" as any)
        .select("id,created_at,voornaam,achternaam,email,status,type,polisnummer")
        .order("created_at", { ascending: false }),
      supabase
        .from("screening_aanvragen" as any)
        .select("id,aangemeld_op,voornaam,achternaam,email,status,screening_type,bedrijfsnaam")
        .order("aangemeld_op", { ascending: false }),
    ]);

    const errors = [leadsRes.error, serviceRes.error, screeningRes.error].filter(Boolean);
    if (errors.length) {
      toast({
        title: "Fout bij laden",
        description: errors.map((e) => e?.message).join(" · "),
        variant: "destructive",
      });
    }

    const leadRows: Row[] = (leadsRes.data ?? []).map((l: any) => ({
      id: l.id,
      type: "lead",
      datum: l.created_at,
      naam: naamOf(l.voornaam, l.achternaam),
      email: l.email ?? "",
      status: l.status ?? "",
      omschrijving: [l.verzekering_type, l.bedrijfsnaam].filter(Boolean).join(" · ") || "Nieuwe lead",
      detailHref: `/admin/leads/${l.id}`,
    }));

    const serviceRows: Row[] = (serviceRes.data ?? []).map((s: any) => ({
      id: s.id,
      type: "service",
      datum: s.created_at,
      naam: naamOf(s.voornaam, s.achternaam),
      email: s.email ?? "",
      status: s.status ?? "",
      omschrijving: [SERVICE_SUBTYPE_LABEL[s.type] ?? s.type, s.polisnummer].filter(Boolean).join(" · "),
      detailHref: `/admin/service-aanvragen`,
    }));

    const screeningRows: Row[] = (screeningRes.data ?? []).map((s: any) => ({
      id: s.id,
      type: "screening",
      datum: s.aangemeld_op,
      naam: naamOf(s.voornaam, s.achternaam),
      email: s.email ?? "",
      status: s.status ?? "",
      omschrijving: [s.screening_type, s.bedrijfsnaam].filter(Boolean).join(" · ") || "Screeningaanvraag",
      detailHref: `/admin/screening-aanvragen`,
    }));

    const all = [...leadRows, ...serviceRows, ...screeningRows].sort(
      (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime(),
    );
    setRows(all);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.status && set.add(r.status));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (typeFilter !== "alle" && r.type !== typeFilter) return false;
    if (statusFilter !== "alle" && r.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${r.naam} ${r.email}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Inbox className="h-7 w-7 text-primary" /> Werkbak
            </h1>
            <p className="text-muted-foreground">
              Alle binnenkomende stromen op één plek — leads, service-aanvragen en screeningen
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
            placeholder="Zoek op naam of email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Datum</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Naam</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Omschrijving</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Laden…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Geen openstaande items</td></tr>
              ) : filtered.map((r) => (
                <tr
                  key={`${r.type}-${r.id}`}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(r.detailHref)}
                >
                  <td className="p-3 whitespace-nowrap">{formatDateNL(r.datum)}</td>
                  <td className="p-3">
                    <Badge className={TYPE_COLOR[r.type]}>{TYPE_LABEL[r.type]}</Badge>
                  </td>
                  <td className="p-3">
                    <div>{r.naam}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="p-3"><Badge variant="secondary">{r.status || "—"}</Badge></td>
                  <td className="p-3 text-muted-foreground">{r.omschrijving}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
