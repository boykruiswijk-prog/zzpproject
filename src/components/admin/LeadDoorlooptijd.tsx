import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { derivePhase } from "@/components/admin/LeadOnboardingStepper";

type ActieType =
  | "lead_in_behandeling"
  | "lead_goedgekeurd"
  | "lead_geactiveerd"
  | "lead_afgewezen";

const RELEVANT: ActieType[] = [
  "lead_in_behandeling",
  "lead_goedgekeurd",
  "lead_geactiveerd",
  "lead_afgewezen",
];

function formatDuur(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} ${sec === 1 ? "seconde" : "seconden"}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} ${min === 1 ? "minuut" : "minuten"}`;
  const uur = Math.round(min / 60);
  if (uur < 48) return `${uur} ${uur === 1 ? "uur" : "uur"}`;
  const dag = Math.round(uur / 24);
  if (dag < 60) return `${dag} ${dag === 1 ? "dag" : "dagen"}`;
  const maand = Math.round(dag / 30);
  return `${maand} ${maand === 1 ? "maand" : "maanden"}`;
}

const PHASE_LABEL: Record<string, string> = {
  nieuw: "Nieuwe aanvraag",
  beoordelen: "Beoordelen",
  goedkeuren: "Goedkeuren",
  activeren: "Polis activeren",
  actief: "Actief",
  afgewezen: "Afgewezen",
};

interface Props {
  lead: any;
}

export function LeadDoorlooptijd({ lead }: Props) {
  const { data: logs } = useQuery({
    queryKey: ["doorlooptijd", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activiteiten_log")
        .select("actie_type, uitgevoerd_op")
        .eq("lead_id", lead.id)
        .in("actie_type", RELEVANT)
        .order("uitgevoerd_op", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const view = useMemo(() => {
    // Neem het EERSTE voorkomen per actie_type (in geval van heruitvoer)
    const first = new Map<ActieType, Date>();
    for (const r of logs ?? []) {
      const t = r.actie_type as ActieType;
      if (!first.has(t)) first.set(t, new Date(r.uitgevoerd_op));
    }
    const start = lead.created_at ? new Date(lead.created_at) : null;
    const inBeh = first.get("lead_in_behandeling") ?? null;
    const goed = first.get("lead_goedgekeurd") ?? null;
    const act = first.get("lead_geactiveerd") ?? null;
    const afg = first.get("lead_afgewezen") ?? null;

    type Row = { label: string; ms: number };
    const rows: Row[] = [];
    if (start && inBeh) rows.push({ label: "Aanvraag → In behandeling", ms: inBeh.getTime() - start.getTime() });
    if (inBeh && goed) rows.push({ label: "In behandeling → Goedgekeurd", ms: goed.getTime() - inBeh.getTime() });
    if (goed && act) rows.push({ label: "Goedgekeurd → Klant", ms: act.getTime() - goed.getTime() });

    const totaalKlant = start && act ? act.getTime() - start.getTime() : null;
    const totaalAfw = start && afg ? afg.getTime() - start.getTime() : null;

    const phase = derivePhase(lead);
    const isAfgewezen = phase === "afgewezen";
    const isActief = phase === "actief";
    const isLopend = !isAfgewezen && !isActief;

    // Laatste bekende stap (voor lopende leads)
    let laatsteStap: Date | null = start;
    let laatsteLabel = "Nieuwe aanvraag";
    if (inBeh) { laatsteStap = inBeh; laatsteLabel = "In behandeling"; }
    if (goed) { laatsteStap = goed; laatsteLabel = "Goedgekeurd"; }

    const nu = new Date();
    const inHuidigeFaseMs = isLopend && laatsteStap ? nu.getTime() - laatsteStap.getTime() : null;

    return {
      rows,
      totaalKlant,
      totaalAfw,
      isAfgewezen,
      isActief,
      isLopend,
      inHuidigeFaseMs,
      huidigeFaseLabel: PHASE_LABEL[phase] ?? phase,
      laatsteLabel,
    };
  }, [logs, lead]);

  // Toon niets als er niks te tonen valt
  if (
    view.rows.length === 0 &&
    view.totaalKlant === null &&
    view.totaalAfw === null &&
    view.inHuidigeFaseMs === null
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Doorlooptijd
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {view.rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium">{formatDuur(r.ms)}</span>
          </div>
        ))}

        {view.isActief && view.totaalKlant !== null && (
          <div className="flex justify-between gap-4 border-t pt-2 mt-2">
            <span className="text-muted-foreground">Totaal (aanvraag → klant)</span>
            <span className="font-semibold">{formatDuur(view.totaalKlant)}</span>
          </div>
        )}

        {view.isAfgewezen && (
          <div className="border-t pt-2 mt-2 space-y-1">
            <p className="text-muted-foreground">
              Deze reis eindigde in een afwijzing.
            </p>
            {view.totaalAfw !== null && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Aanvraag → Afwijzing</span>
                <span className="font-semibold">{formatDuur(view.totaalAfw)}</span>
              </div>
            )}
          </div>
        )}

        {view.isLopend && view.inHuidigeFaseMs !== null && (
          <div className="border-t pt-2 mt-2 text-muted-foreground">
            Loopt al <span className="font-medium text-foreground">{formatDuur(view.inHuidigeFaseMs)}</span> in fase{" "}
            <span className="font-medium text-foreground">{view.huidigeFaseLabel}</span>.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
