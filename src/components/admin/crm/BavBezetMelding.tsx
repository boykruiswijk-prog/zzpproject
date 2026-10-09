import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Bezet = { onderneming_id: string; naam: string | null; exact_relatie_code: string | null; bron: string; nummer: string } | null;
type Aanvraag = { id: string; type: string; naam: string; email: string; created_at: string; onderneming_id: string | null; onderneming_naam: string | null };

/** Melding "bestaat al" bij BAV-nummer bevestigen: toont de andere klant of de serviceaanvraag en biedt een uitweg. */
export function BavBezetMelding({ ondernemingId, nummer, onKlaar }: { ondernemingId: string; nummer: string; onKlaar: () => void }) {
  const { role } = useAuth();
  const magOverride = role === "admin" || role === "supervisor" || role === "verzekering";
  const [info, setInfo] = useState<{ bezet: Bezet; aanvragen: Aanvraag[] } | null>(null);
  const [reden, setReden] = useState("");
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const laad = async () => {
    const { data, error } = await (supabase.rpc as any)("bav_nummer_bezet_info", { _nummer: nummer, _onderneming_id: ondernemingId });
    if (!error) setInfo(data);
  };
  useEffect(() => { laad(); }, [nummer, ondernemingId]);

  const koppelAanvraag = async (id: string) => {
    setBezig(true);
    const { error } = await (supabase.rpc as any)("service_aanvraag_koppelen", { _aanvraag_id: id, _onderneming_id: ondernemingId });
    setBezig(false);
    if (error) return toast.error(error.message);
    toast.success("Aanvraag gekoppeld aan deze klant");
    await laad();
  };

  const override = async () => {
    setBezig(true);
    const { data, error } = await (supabase.rpc as any)("bav_nummer_override_bevestigen", { _onderneming_id: ondernemingId, _nummer: nummer, _reden: reden });
    if (error) { setBezig(false); return toast.error(error.message); }
    if (data?.audit_id) await supabase.functions.invoke("bav-override-melding", { body: { audit_id: data.audit_id } }).catch(() => null);
    setBezig(false);
    toast.success("BAV-nummer gekoppeld (override vastgelegd)");
    onKlaar();
  };

  if (!info) return null;
  const b = info.bezet;
  return (
    <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
      {b ? (
        <p>BAV-nummer {nummer.toUpperCase()} is al bekend bij{" "}
          <Link to={`/admin/klanten/${b.onderneming_id}`} className="font-medium text-primary hover:underline">{b.naam ?? "een andere klant"}</Link>
          {" "}(Exact-relatiecode {b.exact_relatie_code ?? "onbekend"}).</p>
      ) : <p>Het nummer is niet meer bezet. Probeer opnieuw te bevestigen.</p>}
      {info.aanvragen.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
          <span>Serviceaanvraag ({a.type}) van {a.naam || a.email}, {new Date(a.created_at).toLocaleDateString("nl-NL")}{a.onderneming_naam ? `, nu gekoppeld aan ${a.onderneming_naam}` : ", niet gekoppeld"}</span>
          <Button size="sm" variant="outline" disabled={bezig} onClick={() => koppelAanvraag(a.id)}>Koppel deze aanvraag aan deze klant</Button>
        </div>
      ))}
      {b && magOverride && (!open
        ? <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Toch koppelen</Button>
        : <div className="space-y-2">
            <Textarea aria-label="Reden" placeholder="Reden (minimaal 10 tekens)" value={reden} onChange={(e) => setReden(e.target.value)} />
            <Button size="sm" disabled={bezig || reden.trim().length < 10} onClick={override}>Toch koppelen bevestigen</Button>
          </div>)}
    </div>
  );
}
