import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

type Mandaat = { kenmerk: string | null; type: number | null; iban: string | null; datum: string | null };
type Row = {
  id: string; relatiecode: string; naam: string; kenmerk: string; status: string;
  exact_naam: string | null; melding: string | null; bankrekening_actie: string | null;
  bestaande_mandaten: Mandaat[] | null;
};
const STATUSSEN = ["wachtend", "droogrun_ok", "bijgewerkt", "overgeslagen_bestaat_al", "niet_gevonden", "naam_afwijkend", "andere_machtiging_aanwezig", "fout"];
const AANDACHT = ["overgeslagen_bestaat_al", "niet_gevonden", "naam_afwijkend", "andere_machtiging_aanwezig", "fout"];
const fmtMandaten = (m: Mandaat[] | null) =>
  (m ?? []).map((x) => `${x.kenmerk ?? "?"} (${x.type === 0 ? "Core" : x.type === 1 ? "B2B" : x.type ?? "?"}, ${x.iban ?? "?"}, ${x.datum ?? "?"})`).join("; ");

export function ExactMandaatImportBlock() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("exact_mandaat_import")
      .select("id,relatiecode,naam,kenmerk,status,exact_naam,melding,bankrekening_actie,bestaande_mandaten")
      .order("relatiecode", { ascending: true });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const tel = (s: string) => rows.filter((r) => r.status === s).length;
  const aandacht = rows.filter((r) => AANDACHT.includes(r.status));

  const run = async (mode: "droogrun" | "uitvoeren") => {
    setBusy(true); setConfirm(false);
    const { data, error } = await supabase.functions.invoke("exact-mandaat-bulk", { body: { mode, limit: 10 } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      try { const b = await (error as { context?: Response }).context?.json(); msg = b?.melding ?? b?.error ?? msg; } catch { /* */ }
      toast.error(`Mislukt: ${msg}`);
    } else toast.success(data?.melding ?? data?.gestopt ?? `${data?.verwerkt ?? 0} regels verwerkt, ${data?.open ?? 0} open`);
    load();
  };

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Exact-relatiecode", "Naam in CRM", "Naam in Exact", "Kenmerk", "Status", "Melding", "Bankrekening", "Bestaande machtigingen"].map(esc).join(";"),
      ...aandacht.map((r) => [r.relatiecode, r.naam, r.exact_naam, r.kenmerk, r.status, r.melding, r.bankrekening_actie, fmtMandaten(r.bestaande_mandaten)].map(esc).join(";"))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "exact-machtigingen-aandachtspunten.csv"; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Machtigingen naar Exact</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <div className="flex flex-wrap gap-2">
              {STATUSSEN.map((s) => <Badge key={s} variant="secondary">{s}: {tel(s)}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button disabled={busy || tel("wachtend") === 0} onClick={() => run("droogrun")}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Droogrun (10)
              </Button>
              {!confirm ? (
                <Button variant="destructive" disabled={busy || tel("droogrun_ok") === 0} onClick={() => setConfirm(true)}>
                  Uitvoeren (10)
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-destructive p-2">
                  <span className="text-sm">Maximaal 10 machtigingen echt in Exact aanmaken?</span>
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
                    <th className="p-2">Code</th><th className="p-2">Naam in CRM</th><th className="p-2">Naam in Exact</th>
                    <th className="p-2">Kenmerk</th><th className="p-2">Status</th><th className="p-2">Melding</th>
                    <th className="p-2">Bankrekening</th><th className="p-2">Bestaande machtigingen</th>
                  </tr></thead>
                  <tbody>{aandacht.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2">{r.relatiecode}</td><td className="p-2">{r.naam}</td><td className="p-2">{r.exact_naam ?? "—"}</td>
                      <td className="p-2">{r.kenmerk}</td><td className="p-2">{r.status}</td><td className="p-2">{r.melding}</td>
                      <td className="p-2">{r.bankrekening_actie ?? "—"}</td><td className="p-2">{fmtMandaten(r.bestaande_mandaten) || "—"}</td>
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
