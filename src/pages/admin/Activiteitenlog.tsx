import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Row = { id: string; datum: string; medewerker: string; actie: string; klant: string; href?: string; bron: string };

export default function Activiteitenlog() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [medewerker, setMedewerker] = useState("alle");
  const [actie, setActie] = useState("alle");
  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");
  useEffect(() => { if (!isAdmin) return; (async () => {
    const [audit, versies, mails] = await Promise.all([
      supabase.from("sensitive_audit_log").select("*").order("aangemaakt_op", { ascending: false }).limit(500),
      supabase.from("policy_versies").select("*").order("aangemaakt_op", { ascending: false }).limit(500),
      supabase.from("lead_notification_log").select("*").eq("metadata->>internal_notification", "true").order("created_at", { ascending: false }).limit(500),
    ]);
    const combined: Row[] = [];
    for (const r of audit.data ?? []) combined.push({ id: `a-${r.id}`, datum: r.aangemaakt_op, medewerker: r.uitgevoerd_door_email ?? r.uitgevoerd_door_rol ?? "Systeem", actie: `${r.actie}${r.veld ? ` · ${r.veld}` : ""}`, klant: r.target_id ?? "—", bron: r.target_table });
    for (const r of versies.data ?? []) combined.push({ id: `p-${r.id}`, datum: r.aangemaakt_op, medewerker: r.aangemaakt_door_naam ?? "Systeem", actie: `Certificaat ${r.actie ?? "versie"}`, klant: r.policy_id, bron: "certificaat", href: r.lead_id ? `/admin/leads/${r.lead_id}` : undefined });
    for (const r of mails.data ?? []) combined.push({ id: `m-${r.id}`, datum: r.created_at, medewerker: "Systeem", actie: `Interne mail · ${r.status}`, klant: r.recipient, bron: r.lead_type, href: r.lead_id ? `/admin/leads/${r.lead_id}` : undefined });
    setRows(combined.sort((a,b) => +new Date(b.datum) - +new Date(a.datum)));
  })(); }, [isAdmin]);
  const filtered = useMemo(() => rows.filter((r) => (medewerker === "alle" || r.medewerker === medewerker) && (actie === "alle" || r.actie === actie) && (!van || r.datum.slice(0,10) >= van) && (!tot || r.datum.slice(0,10) <= tot)), [rows, medewerker, actie, van, tot]);
  if (!isAdmin) return <Navigate to="/admin" replace />;
  const medewerkers = [...new Set(rows.map((r) => r.medewerker))]; const acties = [...new Set(rows.map((r) => r.actie))];
  return <AdminLayout><div className="space-y-5"><div><h1 className="text-2xl font-bold">Activiteitenlog</h1><p className="text-sm text-muted-foreground">Onveranderbare historie van gevoelige acties en interne meldingen.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Select value={medewerker} onValueChange={setMedewerker}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="alle">Alle medewerkers</SelectItem>{medewerkers.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Select value={actie} onValueChange={setActie}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="alle">Alle acties</SelectItem>{acties.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Input type="date" value={van} onChange={e=>setVan(e.target.value)} aria-label="Van datum"/><Input type="date" value={tot} onChange={e=>setTot(e.target.value)} aria-label="Tot datum"/></div>
    <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b"><th className="p-3 text-left">Wanneer</th><th className="p-3 text-left">Wie</th><th className="p-3 text-left">Wat</th><th className="p-3 text-left">Klant/record</th><th className="p-3 text-left">Bron</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b"><td className="p-3 whitespace-nowrap">{new Date(r.datum).toLocaleString("nl-NL")}</td><td className="p-3">{r.medewerker}</td><td className="p-3">{r.actie}</td><td className="p-3">{r.href?<Link className="text-primary hover:underline" to={r.href}>{r.klant}</Link>:r.klant}</td><td className="p-3">{r.bron}</td></tr>)}</tbody></table></div>
  </div></AdminLayout>;
}