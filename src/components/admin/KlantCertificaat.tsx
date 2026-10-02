import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { CertificaatBeheer } from "@/components/admin/CertificaatBeheer";
import { actiefKlantContract } from "../../../supabase/functions/_shared/certificaatRegels";

interface Props {
  ond: { id: string; naam: string | null; kvk: string | null; afas_contactpersoon?: string | null };
  contracten: any[];
  personen: any[];
  leadIds: string[];
}

export function KlantCertificaat({ ond, contracten, personen, leadIds }: Props) {
  const { isSupervisorOrAdmin } = useAuth();
  const { toast } = useToast();
  const vandaag = new Date().toISOString().split("T")[0];
  const actief = actiefKlantContract(contracten, vandaag);
  const [open, setOpen] = useState(false);
  const [bevestig, setBevestig] = useState(false);
  const [geenNummer, setGeenNummer] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [form, setForm] = useState({ certificate_holder: "", insured_name: "", kvk: "", start_date: "", profession: "", package_type: "" });

  const { data: policies = [], refetch } = useQuery({
    queryKey: ["klant-policies", ond.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("*").eq("onderneming_id", ond.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const openForm = async (bevestigNieuw: boolean) => {
    let profession = "";
    if (leadIds.length) {
      const { data } = await supabase.from("leads").select("branche,beroep").in("id", leadIds);
      const l = (data || []).find((x) => (x.branche || x.beroep || "").trim());
      profession = (l?.branche || l?.beroep || "").trim();
    }
    const p = personen[0];
    const naam = p ? [p.voornaam, p.achternaam].filter(Boolean).join(" ") : "";
    const bav = actief;
    setForm({
      certificate_holder: ond.naam ?? "",
      insured_name: naam || ond.afas_contactpersoon || "",
      kvk: ond.kvk ?? "",
      start_date: bav?.begin_datum ?? "",
      profession,
      package_type: bav ? `BAV & AVB ${bav.cyclus === "jaar" ? "Jaarlijks" : "Maandelijks"}` : "BAV & AVB Jaarlijks",
    });
    setBevestig(bevestigNieuw);
    setOpen(true);
  };

  const genereer = async (bevestigNieuw: boolean) => {
    setBezig(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { onderneming_id: ond.id, policy_data: form, bevestig_nieuw_nummer: bevestigNieuw },
      });
      let fout = data?.error, code = data?.code;
      if (error) {
        try { const j = await (error as any).context?.json?.(); fout = j?.error ?? error.message; code = j?.code; } catch { fout = error.message; }
      }
      if (code === "geen_nummer") { setGeenNummer(true); return; }
      if (fout) throw new Error(fout);
      toast({ title: "Certificaat gemaakt", description: `Nummer ${data.policy.certificate_number}. Er is niets gemaild.` });
      setOpen(false); setGeenNummer(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally { setBezig(false); }
  };

  const download = async (pad: string) => {
    const { data } = await supabase.storage.from("certificates").createSignedUrl(pad, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!isSupervisorOrAdmin && policies.length === 0) return null;
  const compleet = form.profession.trim() && form.certificate_holder.trim() && form.insured_name.trim() && form.start_date;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Certificaat (PDF)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!actief && (
          <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Geen actief verzekeringscontract (opgezegd of afgelopen). Genereren is geblokkeerd.</p>
        )}
        {isSupervisorOrAdmin ? (
          <CertificaatBeheer policies={policies} leadActief={!!actief} isSupervisorOrAdmin={isSupervisorOrAdmin}
            onChanged={refetch} onDownload={download} onNieuw={openForm} />
        ) : null}
        <p className="text-xs text-muted-foreground">De klant houdt zijn bestaande certificaatnummer. Er wordt niets automatisch gemaild.</p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificaat genereren</DialogTitle>
            <DialogDescription>Controleer de gegevens. Afgiftedatum wordt vandaag; "Voor gezien" wordt jouw naam.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {([
              ["certificate_holder", "Certificaathouder"], ["insured_name", "Verzekeringsnemer"], ["kvk", "KvK"],
              ["profession", "Hoedanigheid (verplicht)"], ["package_type", "Pakket"],
            ] as const).map(([k, l]) => (
              <div key={k}><Label htmlFor={`kc-${k}`}>{l}</Label><Input id={`kc-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            <div><Label htmlFor="kc-sd">Ingangsdatum</Label><Input id="kc-sd" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          </div>
          {geenNummer && (
            <p className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" />Deze klant heeft nog geen certificaatnummer. Alleen doorgaan als dat echt klopt: er wordt dan een nieuw nummer uitgegeven.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setGeenNummer(false); }}>Annuleren</Button>
            {geenNummer ? (
              <Button variant="destructive" disabled={!compleet || bezig} onClick={() => genereer(true)}>Ja, nieuw nummer uitgeven</Button>
            ) : (
              <Button disabled={!compleet || bezig} onClick={() => genereer(bevestig)}>{bezig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Genereren</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
