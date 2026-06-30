import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import {
  ServiceAanvraag,
  ServiceAanvraagDetail,
  ServiceAanvraagDetailHeader,
} from "@/components/admin/ServiceAanvraagDetail";

export default function ServiceAanvraagDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aanvraag, setAanvraag] = useState<ServiceAanvraag | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("klant_service_aanvragen" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      toast({ title: "Fout bij laden", description: error.message, variant: "destructive" });
    } else {
      setAanvraag((data as unknown as ServiceAanvraag) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveNotes(rowId: string, notities: string) {
    const { error } = await supabase
      .from("klant_service_aanvragen" as any)
      .update({ notities })
      .eq("id", rowId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Notities opgeslagen" });
  }

  async function markAfgerond(rowId: string) {
    const { error } = await supabase
      .from("klant_service_aanvragen" as any)
      .update({ status: "afgerond" })
      .eq("id", rowId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Status bijgewerkt" });
      if (aanvraag) setAanvraag({ ...aanvraag, status: "afgerond" });
    }
  }

  async function resend(it: ServiceAanvraag) {
    const typeMap = {
      certificaat: "mijn-zp-certificaat",
      pauzeren: "mijn-zp-pauzeren",
      documenten: "mijn-zp-documenten",
      opzeggen: "mijn-zp-opzeggen",
    } as const;
    const { error } = await supabase.functions.invoke("send-lead-notification", {
      body: {
        type: typeMap[it.type],
        leadId: it.id,
        reference: `${it.voornaam} ${it.achternaam} ${it.polisnummer}`,
        userEmail: it.email,
        fields: {
          Naam: `${it.voornaam} ${it.achternaam}`,
          Email: it.email,
          Telefoon: it.telefoon,
          Polisnummer: it.polisnummer,
          ...(it.details || {}),
        },
      },
    });
    if (error) toast({ title: "Fout bij versturen", description: error.message, variant: "destructive" });
    else toast({ title: "Notificatie opnieuw verstuurd" });
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/admin/service-aanvragen")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Terug naar overzicht
        </Button>

        {loading ? (
          <div className="text-muted-foreground">Laden…</div>
        ) : !aanvraag ? (
          <div className="text-muted-foreground">Aanvraag niet gevonden.</div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold">
              <ServiceAanvraagDetailHeader aanvraag={aanvraag} />
            </h1>
            <ServiceAanvraagDetail
              aanvraag={aanvraag}
              onSaveNotes={saveNotes}
              onMarkAfgerond={markAfgerond}
              onResend={resend}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
