import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2, PenLine } from "lucide-react";

const VAKGEBIEDEN = [
  "IT en ICT",
  "HR en finance consultancy",
  "PR en marketing",
  "management consultancy",
  "coaches",
  "zakelijke dienstverlening",
  "algemeen",
];

interface Suggestie {
  titel: string;
  hoofdzoekwoord: string;
  waarom: string;
}

export function SeoOnderwerpenDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [vakgebied, setVakgebied] = useState<string>("algemeen");
  const [busy, setBusy] = useState(false);
  const [resultaten, setResultaten] = useState<Suggestie[]>([]);

  async function genereer() {
    setBusy(true);
    setResultaten([]);
    try {
      const { data, error } = await supabase.functions.invoke("suggereer-onderwerpen", {
        body: { vakgebied },
      });
      if (error) throw error;
      const list = (data as any)?.onderwerpen as Suggestie[] | undefined;
      if (!list?.length) throw new Error("Geen suggesties ontvangen");
      setResultaten(list);
    } catch (e: any) {
      toast({
        title: "Genereren mislukt",
        description: e?.message ?? "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function schrijf(titel: string) {
    setOpen(false);
    navigate(`/admin/kennisbank/nieuw?onderwerp=${encodeURIComponent(titel)}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="h-4 w-4 mr-1" /> SEO-onderwerpen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SEO-onderwerpen voorstellen</DialogTitle>
          <DialogDescription>
            Kies een vakgebied. Claude stelt 8 koopgerichte BAV-onderwerpen voor,
            zonder overlap met bestaande artikelen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <Select value={vakgebied} onValueChange={setVakgebied}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VAKGEBIEDEN.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={genereer} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {resultaten.length ? "Opnieuw genereren" : "Genereer suggesties"}
          </Button>
        </div>

        {resultaten.length > 0 && (
          <div className="space-y-3 mt-4">
            {resultaten.map((s, i) => (
              <div key={i} className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{s.titel}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Zoekwoord: <span className="font-mono">{s.hoofdzoekwoord}</span>
                    </div>
                    <div className="text-sm mt-1 text-muted-foreground">{s.waarom}</div>
                  </div>
                  <Button size="sm" onClick={() => schrijf(s.titel)}>
                    <PenLine className="h-4 w-4 mr-1" /> Schrijf dit artikel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
