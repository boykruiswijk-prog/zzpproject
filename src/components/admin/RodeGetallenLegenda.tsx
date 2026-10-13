import { Link } from "react-router-dom";
import { useMenuTellers } from "@/hooks/useMenuTellers";
import { TELLER_DOEL, tellerUitleg, GRIJZE_TELLERS, type TellerSleutel } from "@/lib/menuTellers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const VOLGORDE: TellerSleutel[] = ["aanvragen", "leads", "afgehaakt", "opzeggingen", "credits_akkoord", "service", "screening", "klanten", "facturatie", "chat", "bav_nakijken"];

/** Kleine legenda: wat betekenen de rode getallen in het menu. */
export function RodeGetallenLegenda() {
  const { data: t } = useMenuTellers();
  const regels = VOLGORDE.filter((k) => (t?.[k] ?? 0) > 0);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Wat betekenen de rode getallen</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="text-muted-foreground">Een rood getal in het menu is werk dat nu op iemand wacht. Klik erop om de lijst te openen. Grijs betekent: nakijken zonder haast, telt niet mee in het totaal.</p>
        {regels.length === 0 ? <p>Er staat nu niets open.</p> : regels.map((k) => (
          <Link key={k} to={TELLER_DOEL[k]} className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-secondary">
            <span className={cn("inline-flex min-w-6 justify-center rounded-full px-2 text-xs font-semibold", GRIJZE_TELLERS.has(k) ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground")}>{t?.[k]}</span>
            <span>{tellerUitleg(k, t ?? {})}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
