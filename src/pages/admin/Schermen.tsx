import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Apparaat = { id: string; naam: string; gekoppeld_door_naam: string | null; gekoppeld_op: string; laatst_gezien_op: string | null; ingetrokken_op: string | null };
const tijd = (d: string | null) => (d ? new Date(d).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }) : "nog niet");
const FOUTEN: Record<string, string> = { verlopen: "Deze code is verlopen. Ververs het scherm voor een nieuwe code.", onbekend: "Code onbekend.", mfa_required: "Log opnieuw in met 2FA.", forbidden: "Alleen supervisor of beheerder." };

async function koppel(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("scherm-koppel", { body });
  if (error) {
    let code = "";
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? ""; } catch { /* leeg */ }
    throw new Error(FOUTEN[code] ?? "Actie mislukt.");
  }
  return data;
}

export default function Schermen() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [naam, setNaam] = useState("");
  const [bezig, setBezig] = useState(false);
  const { data: apparaten = [], isLoading } = useQuery({
    queryKey: ["scherm-apparaten"],
    queryFn: async () => ((await koppel({ actie: "lijst" })).apparaten ?? []) as Apparaat[],
  });

  const koppelen = async (e: React.FormEvent) => {
    e.preventDefault();
    setBezig(true);
    try {
      await koppel({ actie: "koppelen", koppelcode: code, naam });
      toast.success("Scherm gekoppeld");
      setCode(""); setNaam("");
      qc.invalidateQueries({ queryKey: ["scherm-apparaten"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBezig(false); }
  };
  const intrekken = async (a: Apparaat) => {
    if (!window.confirm(`Scherm "${a.naam}" intrekken?`)) return;
    try {
      await koppel({ actie: "intrekken", id: a.id });
      toast.success("Scherm ingetrokken");
      qc.invalidateQueries({ queryKey: ["scherm-apparaten"] });
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Schermen</h1>
        <Card>
          <CardHeader><CardTitle>Nieuw scherm koppelen</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={koppelen} className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="koppelcode">Koppelcode</Label>
                <Input id="koppelcode" value={code} maxLength={6} autoComplete="off" className="font-mono uppercase tracking-widest"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, "").slice(0, 6))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schermnaam">Naam scherm</Label>
                <Input id="schermnaam" value={naam} maxLength={80} placeholder="Kantoor Schiphol-Rijk" onChange={(e) => setNaam(e.target.value)} />
              </div>
              <Button type="submit" disabled={bezig || code.length !== 6 || !naam.trim()}>Koppelen</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Gekoppelde schermen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Laden...</p>}
            {!isLoading && apparaten.length === 0 && <p className="text-sm text-muted-foreground">Nog geen schermen gekoppeld.</p>}
            {apparaten.map((a) => (
              <div key={a.id} data-testid="scherm-rij" className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.naam} {a.ingetrokken_op && <Badge variant="secondary" className="ml-2">Ingetrokken</Badge>}</p>
                  <p className="text-sm text-muted-foreground">
                    Gekoppeld door {a.gekoppeld_door_naam ?? "onbekend"} op {tijd(a.gekoppeld_op)}, laatst gezien {tijd(a.laatst_gezien_op)}
                    {a.ingetrokken_op ? `, ingetrokken op ${tijd(a.ingetrokken_op)}` : ""}
                  </p>
                </div>
                {!a.ingetrokken_op && <Button variant="outline" size="sm" onClick={() => intrekken(a)}>Intrekken</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
