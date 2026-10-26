import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";

export function LeadKlantHistorie({ ondernemingId }: { ondernemingId: string }) {
  const { toonTest } = useToonTestrecords();
  const { data, error } = useQuery({ queryKey: ["lead-klant-historie", ondernemingId, toonTest], queryFn: async () => {
    let q = supabase.from("lead_klant_log").select("*").eq("onderneming_id", ondernemingId).order("created_at", { ascending: false });
    if (!toonTest) q = q.eq("is_test", false);
    const r = await q; if (r.error) throw r.error; return r.data;
  } });
  if (error) return <p className="text-sm text-destructive">Koppelhistorie kon niet worden geladen</p>;
  if (!data?.length) return null;
  return <section className="space-y-2 border-t border-border pt-3"><h3 className="font-medium">Koppelhistorie</h3><ul className="space-y-3 text-sm">{data.map(r => <li key={r.id}><Link className="font-medium text-primary hover:underline" to={r.bron_tabel === "leads" ? `/admin/leads/${r.bron_id}` : `/admin/afgehaakt?record=${r.bron_id}`}>{r.bron_tabel === "leads" ? "Lead" : "Afgehaakte aanvraag"} {r.actie}</Link><p className="text-xs text-muted-foreground">{formatDateTimeNL(r.created_at)}{r.is_test ? " · test" : ""}</p>{r.notitie && <p className="break-words">{r.notitie}</p>}</li>)}</ul></section>;
}