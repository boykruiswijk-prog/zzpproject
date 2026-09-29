import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PortalBulkInviteBlock() {
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [info, setInfo] = useState<string>("");

  const run = async (dry_run: boolean) => {
    setBusy(true); setConfirm(false);
    const { data, error } = await supabase.functions.invoke("send-portal-invite-bulk", { body: { limit, dry_run } });
    setBusy(false);
    if (error) { toast.error(`Mislukt: ${error.message}`); return; }
    const t = dry_run
      ? `${data.kandidaten_totaal} klanten nog niet uitgenodigd; deze batch zou ${data.deze_batch} uitnodigingen versturen.`
      : `${data.verstuurd} verstuurd, ${data.mislukt} mislukt, ${data.nog_open} nog open.`;
    setInfo(t); toast.success(t);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Mijn ZP: klanten uitnodigen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Alleen klanten met een actieve polis die nog nooit zijn uitgenodigd.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="number" min={1} max={200} value={limit} className="w-24"
            onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 50)))} />
          <Button variant="outline" disabled={busy} onClick={() => run(true)}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tellen
          </Button>
          {!confirm ? (
            <Button disabled={busy} onClick={() => setConfirm(true)}>Uitnodigingen versturen ({limit})</Button>
          ) : (
            <>
              <span className="text-sm">Echt {limit} mails versturen?</span>
              <Button variant="destructive" disabled={busy} onClick={() => run(false)}>Ja, versturen</Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Annuleren</Button>
            </>
          )}
        </div>
        {info && <p className="text-sm">{info}</p>}
      </CardContent>
    </Card>
  );
}
