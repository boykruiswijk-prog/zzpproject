import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeNL } from "@/lib/dateFormat";

export type AovDashboardRij = { id: string; created_at: string; naam: string; email: string; telefoon: string | null; doorgeklikt: boolean; ingelogde_klant: boolean };

/** F9: AOV-aanmeldingen zonder test; admin, supervisor en verzekering met tweestapscode. Nooit op /tv of /scherm. */
export function AovOverzicht() {
  const { isSupervisorOrAdmin, isVerzekering, isAal2, user } = useAuth();
  const enabled = (isSupervisorOrAdmin || isVerzekering) && isAal2;
  const [open, setOpen] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["aov-dashboard", user?.id], enabled, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("aov_dashboard_lijst");
      if (error) throw new Error(error.message);
      return (data ?? []) as AovDashboardRij[];
    },
  });
  if (!enabled) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Klik voor de lijst" className="block w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="h-full hover:bg-muted/30" aria-label="AOV-aanmeldingen">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AOV-aanmeldingen</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isError ? <p role="alert" className="text-sm text-destructive">Kon niet worden geladen</p> : <div className="text-2xl font-bold tabular-nums">{data ? data.length : "…"}</div>}
            <p className="text-xs text-muted-foreground">Doorverwijzing naar Tjepkema · zonder test</p>
          </CardContent>
        </Card>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>AOV-aanmeldingen ({data?.length ?? 0})</DialogTitle></DialogHeader>
          <p className="text-sm"><Link to="/admin/aov-doorverwijzingen" className="underline underline-offset-2">Naar AOV-doorverwijzingen</Link></p>
          {!data?.length ? <p className="text-muted-foreground">Nog geen aanmeldingen.</p> : (
            <Table>
              <TableHeader><TableRow>{["Naam", "E-mail", "Telefoon", "Datum", "Ref-code", "Doorgeklikt", "Ingelogde klant"].map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{data.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.naam}</TableCell>
                  <TableCell className="break-all">{r.email}</TableCell>
                  <TableCell>{r.telefoon || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTimeNL(r.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs break-all">{r.id}</TableCell>
                  <TableCell>{r.doorgeklikt ? "Ja" : "Nee"}</TableCell>
                  <TableCell>{r.ingelogde_klant ? "Ja" : "Nee"}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
