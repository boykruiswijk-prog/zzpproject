import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

type Row = {
  id: string; relatiecode: string; naam: string; excel_rij: number | null; status: string;
  exact_naam: string | null; melding: string | null; exact_email_voor: string | null;
};
const STATUSSEN = ["wachtend", "droogrun_ok", "bijgewerkt", "overgeslagen_heeft_al_email", "niet_gevonden", "naam_afwijkend", "fout"];
const AANDACHT = ["niet_gevonden", "naam_afwijkend", "overgeslagen_heeft_al_email", "fout"];

export function ExactEmailImportBlock() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("exact_email_import")
      .select("id,relatiecode,naam,excel_rij,status,exact_naam,melding,exact_email_voor")
      .order("excel_rij", { ascending: true });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const tel = (s: string) => rows.filter((r) => r.status === s).length;
  const aandacht = rows.filter((r) => AANDACHT.includes(r.status));

  const run = async (mode: "droogrun" | "uitvoeren") => {
    setBusy(true); setConfirm(false);
    const { data, error } = await supabase.functions.invoke("exact-email-bulk", { body: { mode, limit: 20 } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      try { const b = await (error as { context?: Response }).context?.json(); msg = b?.melding ?? b?.error ?? msg; } catch { /* */ }
      toast.error(`Mislukt: ${msg}`);
    } else toast.success(data?.melding ?? `${data?.verwerkt ?? 0} regels verwerkt, ${data?.open ?? 0} open`);
    load();
  };

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Excel-rij", "Relatiecode", "Naam in Excel", "Naam in Exact", "Status", "Melding", "E-mail in Exact"].map(esc).join(";"),
      ...aandacht.map((r) => [r.excel_rij, r.relatiecode, r.naam, r.exact_naam, r.status, r.melding, r.exact_email_voor].map(esc).join(";"))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "exact-email-aandachtspunten.csv"; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader><CardTitle>E-mailadressen naar Exact</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <div className="flex flex-wrap gap-2">
              {STATUSSEN.map((s) => <Badge key={s} variant="secondary">{s}: {tel(s)}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button disabled={busy || tel("wachtend") === 0} onClick={() => run("droogrun")}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Droogrun (20)
              </Button>
              {!confirm ? (
                <Button variant="destructive" disabled={busy || tel("droogrun_ok") === 0} onClick={() => setConfirm(true)}>
                  Uitvoeren (20)
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-destructive p-2">
                  <span className="text-sm">Maximaal 20 e-mailadressen echt in Exact zetten?</span>
                  <Button size="sm" variant="destructive" onClick={() => run("uitvoeren")}>Ja, uitvoeren</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>Annuleren</Button>
                </div>
              )}
              <Button variant="outline" disabled={aandacht.length === 0} onClick={csv}>
                <Download className="h-4 w-4 mr-2" />CSV voor administratie
              </Button>
            </div>
            {aandacht.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="p-2">Excel-rij</th><th className="p-2">Code</th><th className="p-2">Naam in Excel</th>
                    <th className="p-2">Naam in Exact</th><th className="p-2">Status</th><th className="p-2">Melding</th>
                  </tr></thead>
                  <tbody>{aandacht.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2">{r.excel_rij}</td><td className="p-2">{r.relatiecode}</td><td className="p-2">{r.naam}</td>
                      <td className="p-2">{r.exact_naam ?? "—"}</td><td className="p-2">{r.status}</td><td className="p-2">{r.melding}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
