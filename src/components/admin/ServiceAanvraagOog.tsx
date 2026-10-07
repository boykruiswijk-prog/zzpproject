import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ServiceAanvraag, ServiceAanvraagDetail, ServiceAanvraagDetailHeader } from "@/components/admin/ServiceAanvraagDetail";

/** Oog-knop: opent de volledige melding (alle formuliervelden) met verwerken en koppelen. */
export function ServiceAanvraagOog({ id, onGewijzigd, label }: { id: string; onGewijzigd?: () => void; label?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<ServiceAanvraag | null>(null);

  async function laad() {
    const { data, error } = await supabase.from("klant_service_aanvragen" as any).select("*").eq("id", id).maybeSingle();
    if (error) toast({ title: "Fout bij laden", description: error.message, variant: "destructive" });
    setA((data as unknown as ServiceAanvraag) ?? null);
  }
  useEffect(() => { if (open) laad(); }, [open, id]);

  async function saveNotes(rowId: string, notities: string) {
    const { error } = await supabase.from("klant_service_aanvragen" as any).update({ notities }).eq("id", rowId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" }); else toast({ title: "Notities opgeslagen" });
  }
  async function markAfgerond(rowId: string) {
    const { error } = await supabase.from("klant_service_aanvragen" as any).update({ status: "afgerond" }).eq("id", rowId);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    toast({ title: "Status bijgewerkt" }); laad(); onGewijzigd?.();
  }

  return (
    <>
      <Button type="button" size={label ? "sm" : "icon"} variant="ghost" className={label ? "min-h-9 gap-1" : "h-8 w-8"} aria-label="Volledige melding bekijken" title="Volledige melding bekijken"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <Eye className="h-4 w-4" />{label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {!a ? <p className="text-sm text-muted-foreground">Laden…</p> : (
            <>
              <DialogHeader><DialogTitle><ServiceAanvraagDetailHeader aanvraag={a} /></DialogTitle></DialogHeader>
              <ServiceAanvraagDetail aanvraag={a} onSaveNotes={saveNotes} onMarkAfgerond={markAfgerond} onGekoppeld={() => { laad(); onGewijzigd?.(); }} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
