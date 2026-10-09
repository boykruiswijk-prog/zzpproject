import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type A = { email?: string | null; geverifieerd?: boolean | null; user_id?: string | null; onderneming_id?: string | null };

const norm = (e?: string | null) => (e ?? "").trim().toLowerCase();

/** Alleen weergave: herkomst "Via website, niet ingelogd" plus e-mailcontrole tegen de gekoppelde klant. */
export function ServiceHerkomstLabels({ aanvraag }: { aanvraag: A }) {
  const toon = !aanvraag.geverifieerd && !aanvraag.user_id;
  const ond = aanvraag.onderneming_id ?? null;
  const email = norm(aanvraag.email);
  const { data: klopt } = useQuery({
    queryKey: ["service-email-check", ond, email],
    enabled: toon && !!ond && !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: o }, { data: po }] = await Promise.all([
        supabase.from("ondernemingen").select("factuur_email").eq("id", ond!).maybeSingle(),
        supabase.from("persoon_onderneming").select("personen(genormaliseerd_email)").eq("onderneming_id", ond!),
      ]);
      if (norm((o as any)?.factuur_email) === email) return true;
      return (po ?? []).some((r: any) => norm(r.personen?.genormaliseerd_email) === email);
    },
  });
  if (!toon) return null;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild><Badge variant="outline" className="w-fit cursor-help">Via website, niet ingelogd</Badge></TooltipTrigger>
        <TooltipContent className="max-w-xs">Deze aanvraag is ingediend zonder in te loggen. Controleer of het e-mailadres hoort bij de klant voordat je iets wijzigt of opzegt.</TooltipContent>
      </Tooltip>
      {!ond
        ? <Badge className="w-fit bg-red-100 text-red-800 hover:bg-red-100">Niet gekoppeld aan klant</Badge>
        : klopt === undefined ? null
        : klopt
          ? <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">E-mail klopt</Badge>
          : <Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">E-mail onbekend bij klant</Badge>}
    </>
  );
}
