import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";

interface ActiviteitRow {
  id: string;
  actie_type: string;
  omschrijving: string;
  uitgevoerd_door: string | null;
  uitgevoerd_door_naam: string | null;
  lead_id: string | null;
  klant_email: string | null;
  aangemaakt_op: string;
}

export default function Activiteiten() {
  const [rows, setRows] = useState<ActiviteitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [medewerker, setMedewerker] = useState<string>("alle");
  const [actie, setActie] = useState<string>("alle");
  const [zoek, setZoek] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("activiteiten_log")
        .select("*")
        .order("aangemaakt_op", { ascending: false })
        .limit(500);
      if (!error && data) setRows(data as ActiviteitRow[]);
      setLoading(false);
    })();
  }, []);

  const medewerkers = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.uitgevoerd_door) {
        map.set(r.uitgevoerd_door, r.uitgevoerd_door_naam || "Onbekend");
      }
    });
    return Array.from(map.entries());
  }, [rows]);

  const actieTypes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.actie_type))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return rows.filter((r) => {
      if (medewerker !== "alle" && r.uitgevoerd_door !== medewerker) return false;
      if (actie !== "alle" && r.actie_type !== actie) return false;
      if (q) {
        const hay = `${r.omschrijving} ${r.klant_email ?? ""} ${r.uitgevoerd_door_naam ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, medewerker, actie, zoek]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Activiteiten</h1>
          <p className="text-sm text-muted-foreground">
            Transparant log van alle betekenisvolle handelingen in het admin-paneel. Regels kunnen niet aangepast of verwijderd worden.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Zoeken op omschrijving of klant…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            className="max-w-xs"
          />
          <Select value={medewerker} onValueChange={setMedewerker}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Medewerker" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle medewerkers</SelectItem>
              {medewerkers.map(([id, naam]) => (
                <SelectItem key={id} value={id}>{naam}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actie} onValueChange={setActie}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Actietype" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle acties</SelectItem>
              {actieTypes.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Datum/tijd</TableHead>
                <TableHead className="w-48">Wie</TableHead>
                <TableHead>Wat</TableHead>
                <TableHead className="w-64">Betrokken lead/klant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Geen activiteiten gevonden.</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.aangemaakt_op).toLocaleString("nl-NL")}
                    </TableCell>
                    <TableCell className="text-sm">{r.uitgevoerd_door_naam ?? "Onbekend"}</TableCell>
                    <TableCell className="text-sm">{r.omschrijving}</TableCell>
                    <TableCell className="text-sm">
                      {r.lead_id ? (
                        <Link to={`/admin/leads/${r.lead_id}`} className="text-primary hover:underline">
                          {r.klant_email ?? "Lead openen"}
                        </Link>
                      ) : (
                        r.klant_email ?? "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
