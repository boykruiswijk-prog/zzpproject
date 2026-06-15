import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateNL } from "@/lib/dateFormat";

interface ScreeningAanvraag {
  id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  bedrijfsnaam: string | null;
  screening_type: string | null;
  status: string;
  otentica_status: string;
  aangemeld_op: string;
}

const STATUS_KLEUREN: Record<string, string> = {
  nieuw: "bg-muted text-muted-foreground",
  verzonden: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-orange-100 text-orange-800",
  afgerond: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

const PAKKET_LABELS: Record<string, string> = {
  basis: "Basis",
  uitgebreid: "Uitgebreid",
  compleet: "Compleet",
};

export default function AdminScreeningAanvragen() {
  const [aanvragen, setAanvragen] = useState<ScreeningAanvraag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("screening_aanvragen")
        .select("id, voornaam, achternaam, email, bedrijfsnaam, screening_type, status, otentica_status, aangemeld_op")
        .order("aangemeld_op", { ascending: false });
      if (!error && data) setAanvragen(data as ScreeningAanvraag[]);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Screening aanvragen</h1>
          <p className="text-muted-foreground">Beheer en volg alle screeningsaanvragen</p>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Bedrijfsnaam</TableHead>
                <TableHead>Pakket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Otentica status</TableHead>
                <TableHead>Aangemeld op</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : aanvragen.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nog geen aanvragen</TableCell></TableRow>
              ) : (
                aanvragen.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.voornaam} {a.achternaam}</TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                    <TableCell>{a.bedrijfsnaam || "-"}</TableCell>
                    <TableCell>{a.screening_type ? PAKKET_LABELS[a.screening_type] || a.screening_type : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_KLEUREN[a.status] || ""}>
                        {a.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.otentica_status.replace("_", " ")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateNL(a.aangemeld_op)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}
