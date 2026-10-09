import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Recipient = { id: string; email: string; actief: boolean; soort: string };
const SOORTEN = [
  { key: "algemeen", titel: "Algemene meldingen", uitleg: "Nieuwe aanvragen, opzeggingen, contact- en terugbelverzoeken." },
  { key: "exact_boeking", titel: "Exact-boeking", uitleg: "Controlemail bij elke boeking naar Exact (ook mislukte) en de ochtendcontrole op concepten." },
  { key: "bav_override", titel: "BAV-nummer override", uitleg: "Melding als een BAV-nummer bewust wordt gekoppeld terwijl het al bij een andere klant bekend is." },
];

export default function InterneMeldingen() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<Recipient[]>([]);
  const [email, setEmail] = useState<Record<string, string>>({});
  const load = async () => {
    const { data, error } = await supabase.from("interne_melding_ontvangers").select("id,email,actief,soort").order("email");
    if (error) toast.error(error.message); else setRows(data ?? []);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);
  if (!isAdmin) return <Navigate to="/admin" replace />;
  const add = async (soort: string) => {
    const value = (email[soort] ?? "").trim().toLowerCase();
    if (!user || !value) return;
    const { error } = await supabase.from("interne_melding_ontvangers").insert({ email: value, soort, aangemaakt_door: user.id, bijgewerkt_door: user.id });
    if (error) return toast.error(error.message);
    setEmail({ ...email, [soort]: "" }); load();
  };
  const remove = async (id: string, soort: string) => {
    if (rows.filter((r) => r.soort === soort).length <= 1) return toast.error("Minimaal één ontvanger per meldingssoort is verplicht.");
    const { error } = await supabase.from("interne_melding_ontvangers").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  return <AdminLayout><div className="max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-bold">Interne meldingen</h1><p className="text-sm text-muted-foreground">Iedere ontvanger krijgt en logt een eigen exemplaar.</p></div>
    {SOORTEN.map((soort) => <Card key={soort.key}><CardHeader><CardTitle>{soort.titel}</CardTitle><p className="text-sm text-muted-foreground">{soort.uitleg}</p></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row"><Input type="email" value={email[soort.key] ?? ""} onChange={(e) => setEmail({ ...email, [soort.key]: e.target.value })} placeholder="naam@zpzaken.nl" className="min-h-10"/><Button onClick={() => add(soort.key)} className="min-h-10"><Plus className="mr-2 h-4 w-4"/>Toevoegen</Button></div>
      <div className="divide-y rounded-md border">{rows.filter((row) => row.soort === soort.key).map((row) => <div key={row.id} className="flex min-h-12 items-center justify-between gap-3 px-3"><span className="break-all text-sm">{row.email}</span><Button variant="ghost" size="icon" aria-label={`${row.email} verwijderen`} onClick={() => remove(row.id, soort.key)}><Trash2 className="h-4 w-4"/></Button></div>)}</div>
    </CardContent></Card>)}
  </div></AdminLayout>;
}