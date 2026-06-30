import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import {
  ScreeningAanvraagDetail,
  ScreeningAanvraagDetailHeader,
  ScreeningAanvraagFull,
} from "@/components/admin/ScreeningAanvraagDetail";

export default function ScreeningAanvraagDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aanvraag, setAanvraag] = useState<ScreeningAanvraagFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("screening_aanvragen")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        toast({ title: "Fout bij laden", description: error.message, variant: "destructive" });
      } else {
        setAanvraag((data as ScreeningAanvraagFull) ?? null);
      }
      setLoading(false);
    })();
  }, [id, toast]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/admin/screening-aanvragen")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Terug naar overzicht
        </Button>

        {loading ? (
          <div className="text-muted-foreground">Laden…</div>
        ) : !aanvraag ? (
          <div className="text-muted-foreground">Aanvraag niet gevonden.</div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold">
              <ScreeningAanvraagDetailHeader aanvraag={aanvraag} />
            </h1>
            <ScreeningAanvraagDetail aanvraag={aanvraag} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
