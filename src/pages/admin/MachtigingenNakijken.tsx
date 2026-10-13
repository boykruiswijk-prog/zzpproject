import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import { useMachtigingenNakijken, type MachtigingRij } from "@/hooks/useMachtigingenNakijken";

function Lijst({ titel, uitleg, rijen, verlopen }: { titel: string; uitleg: string; rijen: MachtigingRij[]; verlopen?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base">{titel}<Badge variant="secondary">{rijen.length}</Badge></CardTitle>
        <p className="text-sm text-muted-foreground">{uitleg}</p></CardHeader>
      <CardContent className="space-y-1 text-sm">
        {rijen.length === 0 ? <p className="text-muted-foreground">Niets om na te kijken.</p> : rijen.map((r, i) => (
          <div key={`${r.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1.5">
            <Link to={`/admin/klanten/${r.id}`} className="font-medium hover:text-primary">{r.naam ?? "Onbekend"}</Link>
            <span className="text-muted-foreground">Exact-relatiecode {r.relatiecode ?? "onbekend"}{verlopen ? ` · kenmerk ${r.kenmerk ?? "-"} · verlopen ${formatDateNL(r.vervaldatum ?? null)}` : ""}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function MachtigingenNakijken() {
  const { data, isLoading, error } = useMachtigingenNakijken();
  return (
    <AdminLayout>
      <Helmet><title>Machtigingen nakijken | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Machtigingen nakijken</h1>
          <p className="text-sm text-muted-foreground">Klanten met een lopend contract waarvan de incassomachtiging aandacht nodig heeft. Geen haast; dit telt niet mee in de rode getallen.</p></div>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : error || !data ? <p className="text-destructive">Overzicht kon niet worden geladen.</p> : (
          <>
            <Lijst titel="Wel een AFAS-machtiging, niet in Exact" uitleg="Er is een machtiging uit AFAS, maar volgens de Exact-export staat die niet in Exact." rijen={data.niet_in_exact} />
            <Lijst titel="Geen enkele machtiging" uitleg="Er is geen machtiging bekend, niet uit AFAS en niet uit Exact." rijen={data.zonder} />
            <Lijst titel="Verlopen machtigingen" uitleg="De vervaldatum van de machtiging is voorbij." rijen={data.verlopen} verlopen />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
