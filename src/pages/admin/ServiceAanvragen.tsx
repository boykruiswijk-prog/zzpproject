import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ConciergeBell, RotateCw } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import {
  ServiceAanvraagDetail,
  ServiceAanvraagDetailHeader,
} from "@/components/admin/ServiceAanvraagDetail";

type Aanvraag = {
  id: string;
  type: "certificaat" | "pauzeren" | "documenten" | "opzeggen";
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string;
  polisnummer: string;
  status: string;
  details: Record<string, any> | null;
  notities: string | null;
  behandeld_door: string | null;
  behandeld_op: string | null;
  created_at: string;
};

const STATUS = [
  { value: "nieuw", label: "Nieuw" },
  { value: "in_behandeling", label: "In behandeling" },
  { value: "afgerond", label: "Afgerond" },
  { value: "gearchiveerd", label: "Gearchiveerd" },
];

const TYPE_COLOR: Record<string, string> = {
  certificaat: "bg-blue-100 text-blue-800",
  pauzeren: "bg-amber-100 text-amber-800",
  documenten: "bg-emerald-100 text-emerald-800",
  opzeggen: "bg-red-100 text-red-800",
};

const TYPE_LABEL: Record<string, string> = {
  certificaat: "Polis",
  pauzeren: "Pauzeren",
  documenten: "Documenten",
  opzeggen: "Opzeggen",
};

const STATUS_COLOR: Record<string, string> = {
  nieuw: "bg-red-100 text-red-800",
  in_behandeling: "bg-amber-100 text-amber-800",
  afgerond: "bg-emerald-100 text-emerald-800",
  gearchiveerd: "bg-gray-100 text-gray-700",
};

const formatDate = formatDateNL;

export default function ServiceAanvragen() {
  const { toast } = useToast();
  const [items, setItems] = useState<Aanvraag[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Aanvraag | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("klant_service_aanvragen" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Fout bij laden", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as unknown as Aanvraag[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((it) => {
    if (typeFilter !== "alle" && it.type !== typeFilter) return false;
    if (statusFilter !== "alle" && it.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${it.voornaam} ${it.achternaam} ${it.email} ${it.polisnummer}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("klant_service_aanvragen" as any).update({ status }).eq("id", id);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Status bijgewerkt" });
      load();
      if (selected?.id === id) setSelected({ ...selected, status });
    }
  }

  async function saveNotes(id: string, notities: string) {
    const { error } = await supabase.from("klant_service_aanvragen" as any).update({ notities }).eq("id", id);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Notities opgeslagen" });
  }

  async function resendNotification(it: Aanvraag) {
    const typeMap = {
      certificaat: "mijn-zp-certificaat",
      pauzeren: "mijn-zp-pauzeren",
      documenten: "mijn-zp-documenten",
      opzeggen: "mijn-zp-opzeggen",
    } as const;
    const { error } = await supabase.functions.invoke("send-lead-notification", {
      body: {
        type: typeMap[it.type],
        leadId: it.id,
        reference: `${it.voornaam} ${it.achternaam} ${it.polisnummer}`,
        userEmail: it.email,
        fields: {
          Naam: `${it.voornaam} ${it.achternaam}`,
          Email: it.email,
          Telefoon: it.telefoon,
          Polisnummer: it.polisnummer,
          ...(it.details || {}),
        },
      },
    });
    if (error) toast({ title: "Fout bij versturen", description: error.message, variant: "destructive" });
    else toast({ title: "Notificatie opnieuw verstuurd" });
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ConciergeBell className="h-7 w-7 text-primary" /> Service-aanvragen
            </h1>
            <p className="text-muted-foreground">
              Polis-, pauzeer-, document- en opzeg-aanvragen vanuit Mijn ZP
            </p>
          </div>
          <Button variant="outline" onClick={load}><RotateCw className="h-4 w-4 mr-2" />Herladen</Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle types</SelectItem>
              <SelectItem value="certificaat">Polis</SelectItem>
              <SelectItem value="pauzeren">Pauzeren</SelectItem>
              <SelectItem value="documenten">Documenten</SelectItem>
              <SelectItem value="opzeggen">Opzeggen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statussen</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Zoek op naam, polis of email"
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
                <th className="text-left p-3">Polisnummer</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Acties</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Laden…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Geen aanvragen</td></tr>
              ) : filtered.map((it) => (
                <tr key={it.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(it)}>
                  <td className="p-3 whitespace-nowrap">{formatDate(it.created_at)}</td>
                  <td className="p-3"><Badge className={TYPE_COLOR[it.type]}>{TYPE_LABEL[it.type] ?? it.type}</Badge></td>
                  <td className="p-3">{it.voornaam} {it.achternaam}</td>
                  <td className="p-3 font-mono text-xs">{it.polisnummer}</td>
                  <td className="p-3">{it.email}</td>
                  <td className="p-3"><Badge className={STATUS_COLOR[it.status] || ""}>{it.status}</Badge></td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Select value={it.status} onValueChange={(v) => updateStatus(it.id, v)}>
                      <SelectTrigger className="w-36 h-8 inline-flex"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <ServiceAanvraagDetailHeader aanvraag={selected} />
                </DialogTitle>
              </DialogHeader>
              <ServiceAanvraagDetail
                aanvraag={selected}
                onSaveNotes={saveNotes}
                onMarkAfgerond={(id) => updateStatus(id, "afgerond")}
                onResend={resendNotification}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
