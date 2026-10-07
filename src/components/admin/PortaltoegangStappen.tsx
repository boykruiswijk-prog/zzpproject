import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { KoppelZoeker } from "@/components/admin/KoppelZoeker";
import type { ServiceAanvraag } from "@/components/admin/ServiceAanvraagDetail";

const Stap = ({ nr, klaar, titel, children }: { nr: number; klaar: boolean; titel: string; children: React.ReactNode }) => (
  <li className="rounded-md border border-border p-3">
    <p className="mb-2 flex items-center gap-2 font-medium">
      {klaar ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      {nr}. {titel}
    </p>
    <div className="space-y-2">{children}</div>
  </li>
);

/**
 * Stappen voor een portaltoegang-aanvraag: verificatie, klant zoeken, koppelen, toegang verlenen, afronden.
 * Er gaat alleen een mail uit bij de klik op "Toegang verlenen" (crm-portal-uitnodigen). Alles wordt gelogd.
 */
export function PortaltoegangStappen({ aanvraag, onGewijzigd }: { aanvraag: ServiceAanvraag; onGewijzigd?: () => void }) {
  const { toast } = useToast();
  const d = aanvraag.details ?? {};
  const email = (aanvraag.email ?? "").toLowerCase();
  const [klant, setKlant] = useState<{ naam: string | null; exact_relatie_code: string | null } | null>(null);
  const [bekend, setBekend] = useState<boolean | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [toelichting, setToelichting] = useState("");
  const afgerond = aanvraag.status === "afgerond";
  const verleend = d.toegang_verleend as { op: string; door_naam?: string; email: string; handmatig_gecontroleerd?: boolean } | undefined;

  useEffect(() => {
    setKlant(null); setBekend(null); setHtml(null);
    if (!aanvraag.onderneming_id) return;
    supabase.from("ondernemingen").select("naam,exact_relatie_code").eq("id", aanvraag.onderneming_id).maybeSingle().then(({ data }) => setKlant(data));
    // Voorbeeld ophalen: verstuurt niets, vertelt of het adres al bij de klant bekend is.
    supabase.functions.invoke("crm-portal-uitnodigen", { body: { onderneming_id: aanvraag.onderneming_id, aanvraag_id: aanvraag.id, email, modus: "voorbeeld" } })
      .then(({ data }) => { if (data?.ok) { setBekend(!!data.bekend_bij_klant); setHtml(data.html); } });
  }, [aanvraag.id, aanvraag.onderneming_id]);

  async function koppel(ondId: string) {
    setBezig("koppel");
    const { error } = await (supabase.rpc as any)("portaltoegang_koppelen", { _aanvraag_id: aanvraag.id, _onderneming_id: ondId });
    setBezig(null);
    if (error) return toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Gekoppeld aan klant" }); onGewijzigd?.();
  }
  async function verleen() {
    setBezig("verleen");
    const { data, error } = await supabase.functions.invoke("crm-portal-uitnodigen", {
      body: { onderneming_id: aanvraag.onderneming_id, aanvraag_id: aanvraag.id, email, modus: "versturen" },
    });
    setBezig(null);
    if (error || !data?.ok) return toast({ title: "Toegang verlenen mislukt", description: data?.error ?? error?.message, variant: "destructive" });
    toast({ title: "Toegang verleend", description: `Uitnodiging verstuurd aan ${data.aan}` }); onGewijzigd?.();
  }
  async function rondAf() {
    setBezig("afronden");
    const { error } = await (supabase.rpc as any)("portaltoegang_afronden", { _aanvraag_id: aanvraag.id, _toelichting: toelichting || null });
    setBezig(null);
    if (error) return toast({ title: "Afronden mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Aanvraag afgerond" }); onGewijzigd?.();
  }

  return (
    <ol className="space-y-3 text-sm">
      <Stap nr={1} klaar={!!aanvraag.geverifieerd || bekend === true} titel="E-mailverificatie">
        {aanvraag.geverifieerd ? <Badge variant="secondary">Geverifieerd</Badge> : (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-2">
            <Badge variant="outline" className="mb-1 border-amber-500 text-amber-700">Ongeverifieerd</Badge>
            <p>Iemand heeft met <span className="font-medium">{aanvraag.email}</span> geprobeerd in te loggen op Mijn ZP. Dit adres had nog geen toegang. Dat iemand dit adres echt gebruikt, is nog niet bewezen.</p>
            <p className="mt-1 text-muted-foreground">De uitnodiging gaat altijd naar dit adres. Alleen wie die mailbox kan lezen, kan inloggen. Controleer wel eerst of het adres of het domein bij de klant hoort.</p>
          </div>
        )}
        {d.heeft_account && <p className="text-muted-foreground">Er bestaat al een account op dit adres, maar zonder gekoppelde polis.</p>}
      </Stap>

      <Stap nr={2} klaar={!!aanvraag.onderneming_id} titel="Klant zoeken">
        {afgerond ? <p className="text-muted-foreground">Aanvraag is afgerond.</p> : (
          <KoppelZoekerPortal aanvraagId={aanvraag.id} gekoppeld={aanvraag.onderneming_id ?? null} onKoppel={koppel} bezig={bezig === "koppel"} />
        )}
      </Stap>

      <Stap nr={3} klaar={!!aanvraag.onderneming_id} titel="Gekoppeld aan klant">
        {aanvraag.onderneming_id ? (
          <p><Link to={`/admin/klanten/${aanvraag.onderneming_id}`} className="font-medium text-primary hover:underline">{klant?.naam ?? "Klant"}</Link>
            <span className="text-muted-foreground"> · Exact-relatiecode {klant?.exact_relatie_code ?? "onbekend"}</span></p>
        ) : <p className="text-muted-foreground">Nog niet gekoppeld. Kies hierboven een klant.</p>}
        {aanvraag.onderneming_id && bekend !== null && (
          bekend ? <p className="text-muted-foreground">Het adres is bekend bij deze klant (contactpersoon of factuur-e-mail).</p>
            : <p className="text-amber-700">Het adres staat nog niet bij deze klant. Bij Toegang verlenen wordt het als contactpersoon toegevoegd.</p>
        )}
      </Stap>

      <Stap nr={4} klaar={!!verleend} titel="Toegang verlenen">
        {verleend && <p>Uitnodiging verstuurd aan {verleend.email} op {formatDateTimeNL(verleend.op)}{verleend.door_naam ? ` door ${verleend.door_naam}` : ""}{(verleend as any).contactpersoon === "nieuw" ? " (contactpersoon toegevoegd)" : ""}.</p>}
        {!afgerond && aanvraag.onderneming_id && (<>
          {bekend === false && (
            <p className="rounded-md border border-border bg-muted/40 p-2">Dit e-mailadres wordt toegevoegd als contactpersoon bij {klant?.naam ?? "deze klant"}.</p>
          )}
          {html && <details><summary className="cursor-pointer text-muted-foreground">Voorbeeld van de mail</summary><iframe title="Voorbeeld uitnodiging" srcDoc={html} sandbox="" className="mt-2 h-80 w-full rounded border" /></details>}
          <p className="text-xs text-muted-foreground">Er gaat pas een mail naar {aanvraag.email} als je op de knop klikt.</p>
          <Button size="sm" className="min-h-10" disabled={!!bezig || bekend === null} onClick={verleen}>
            {bezig === "verleen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {verleend ? "Opnieuw uitnodigen" : "Toegang verlenen"}
          </Button>
        </>)}
      </Stap>

      <Stap nr={5} klaar={afgerond} titel="Afronden">
        {afgerond ? <p>Afgerond{aanvraag.behandeld_op ? ` op ${formatDateTimeNL(aanvraag.behandeld_op)}` : ""}{d.afgerond?.toelichting ? `: ${d.afgerond.toelichting}` : "."}</p> : (<>
          <Textarea rows={2} maxLength={500} placeholder="Toelichting (optioneel), bijvoorbeeld waarom geen toegang" value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
          <Button size="sm" variant="outline" className="min-h-10" disabled={!!bezig} onClick={rondAf}>{bezig === "afronden" && <Loader2 className="h-4 w-4 animate-spin" />}Markeer als afgerond</Button>
        </>)}
      </Stap>
    </ol>
  );
}

/** Zoeklijst met koppelknop voor portaltoegang (zelfde zoekfunctie, eigen koppelactie). */
function KoppelZoekerPortal({ aanvraagId, gekoppeld, onKoppel, bezig }: { aanvraagId: string; gekoppeld: string | null; onKoppel: (id: string) => void; bezig: boolean }) {
  return <KoppelZoeker aanvraagId={aanvraagId} kanKoppelen gekoppeldId={gekoppeld} onKoppel={onKoppel} extBezig={bezig} />;
}
