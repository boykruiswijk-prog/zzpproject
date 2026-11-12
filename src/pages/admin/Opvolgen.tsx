import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Item = { item_soort: "concept" | "terugbel" | "offerte"; item_id: string; aangemaakt_op: string; stap: number | null; pakket: string | null; naam: string | null; signaal_1_op: string | null; signaal_2_op: string | null };
const LABEL = { concept: "Afgehaakte aanvraag", terugbel: "Terugbelverzoek", offerte: "Offerte-aanvraag" } as const;

const urenOpen = (iso: string) => {
  const u = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return u >= 48 ? `${Math.floor(u / 24)} dagen` : `${Math.round(u)} uur`;
};

/** A30 Lasso: alle open items, oudste eerst. Opvolgen gebruikt het bestaande veld (concept: opgevolgd_op, lead: status). */
export default function AdminOpvolgen() {
  const { user } = useAuth();
  const [rijen, setRijen] = useState<Item[]>([]);
  const [laden, setLaden] = useState(true);

  const laad = async () => {
    setLaden(true);
    const { data, error } = await (supabase.rpc as any)("opvolg_overzicht");
    if (error) toast({ title: "Laden mislukt", description: error.message, variant: "destructive" });
    setRijen((data ?? []) as Item[]);
    setLaden(false);
  };
  useEffect(() => { void laad(); }, []);

  const opgevolgd = async (r: Item) => {
    const { error } = r.item_soort === "concept"
      ? await supabase.from("aanvraag_concepten").update({ opgevolgd_op: new Date().toISOString(), opgevolgd_door: user?.id ?? null } as any).eq("id", r.item_id)
      : await supabase.from("leads").update({ status: "in_behandeling" } as any).eq("id", r.item_id);
    if (error) { toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" }); return; }
    setRijen((rs) => rs.filter((x) => x.item_id !== r.item_id));
    toast({ title: "Gemarkeerd als opgevolgd" });
  };

  return (
    <AdminLayout>
            <Card>
        <CardHeader><CardTitle>Opvolgen ({rijen.length})</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Alles wat langer dan 2 uur open staat, oudste bovenaan. Lasso stuurt per item maximaal twee signalen: na 2 uur en na 24 uur.</p>
          {laden ? <Loader2 className="h-5 w-5 animate-spin" /> : rijen.length === 0 ? <p className="text-sm">Niets open. Alles is opgevolgd.</p> : (
            <ul className="divide-y">
              {rijen.map((r) => (
                <li key={`${r.item_soort}-${r.item_id}`} className="flex flex-wrap items-center gap-3 py-3">
                  <Badge variant={r.signaal_2_op ? "destructive" : "secondary"}>{LABEL[r.item_soort]}</Badge>
                  <span className="font-medium">{r.naam ?? "Zonder naam"}</span>
                  <span className="text-sm text-muted-foreground">open {urenOpen(r.aangemaakt_op)} (sinds {formatDateTimeNL(r.aangemaakt_op)})</span>
                  {r.stap != null && <span className="text-sm text-muted-foreground">stap {r.stap}</span>}
                  {r.pakket && <span className="text-sm text-muted-foreground">{r.pakket}</span>}
                  <span className="ml-auto flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={r.item_soort === "concept" ? `/admin/afgehaakt?record=${r.item_id}` : `/admin/leads/${r.item_id}`}>Openen</Link>
                    </Button>
                    <Button size="sm" onClick={() => opgevolgd(r)}>Opgevolgd</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
