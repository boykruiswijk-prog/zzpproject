import { useState } from "react";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export type IbanBron = "onderneming" | "mandaat" | "lead" | "bav" | "sepa" | "screening" | "taak";

/** Maskeert een IBAN als NL** **** **** 1234. */
export function maskeerIbanVol(iban?: string | null): string {
  const s = (iban ?? "").replace(/\s/g, "").toUpperCase();
  if (s.length < 8) return s ? "****" : "-";
  return `${s.slice(0, 2)}** **** **** ${s.slice(-4)}`;
}
const groepeer = (s: string) => s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

/**
 * Toont een IBAN standaard gemaskeerd. "Toon IBAN" haalt het volledige IBAN op via RPC iban_inzien
 * (alleen supervisor/admin/verzekering met 2FA, elke inzage in sensitive_audit_log).
 */
export function IbanInzien({ bron, id, gemaskeerd }: { bron: IbanBron; id: string; gemaskeerd?: string | null }) {
  const { toast } = useToast();
  const [vol, setVol] = useState<{ iban: string | null; oud: string | null; nieuw: string | null } | null>(null);
  const [laden, setLaden] = useState(false);

  async function toon() {
    setLaden(true);
    const { data, error } = await supabase.rpc("iban_inzien" as any, { _bron: bron, _id: id });
    setLaden(false);
    if (error) return toast({ title: "IBAN kon niet worden getoond", description: error.message, variant: "destructive" });
    setVol(data as any);
  }
  async function kopieer(v: string) {
    try { await navigator.clipboard.writeText(v.replace(/\s/g, "")); toast({ title: "IBAN gekopieerd" }); }
    catch { toast({ title: "Kopiëren lukte niet", variant: "destructive" }); }
  }
  const Regel = ({ label, v }: { label?: string; v: string | null }) => (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="break-all font-mono">{v ? groepeer(v) : "-"}</span>
      {v && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="IBAN kopiëren" onClick={() => kopieer(v)}><Copy className="h-3.5 w-3.5" /></Button>}
    </span>
  );

  if (vol) {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
        {bron === "taak" ? (<><Regel label="Oud:" v={vol.oud} /><Regel label="Nieuw:" v={vol.nieuw} /></>) : <Regel v={vol.iban} />}
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={() => setVol(null)}><EyeOff className="h-3.5 w-3.5" />Verberg</Button>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      {gemaskeerd !== undefined && <span className="font-mono">{gemaskeerd ? maskeerIbanVol(gemaskeerd) : "-"}</span>}
      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={toon} disabled={laden}>
        {laden ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{bron === "taak" ? "Toon oud en nieuw IBAN" : "Toon IBAN"}
      </Button>
    </span>
  );
}
