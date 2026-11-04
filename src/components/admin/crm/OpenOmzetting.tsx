import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openOmzetting, type OpenOmzetting } from "@/lib/omzetting";
import { OmzettenNaarBv } from "./OmzettenNaarBv";

type Ond = { id: string; naam: string; kvk: string | null; rechtsvorm?: string | null };

/** Opvolging (rechtsvormwijziging) naar deze onderneming waarvan de polis nog bij de voorganger staat. */
export function useOpenOmzetting(ondernemingId: string | undefined, herlaad = 0) {
  return useQuery({
    queryKey: ["open-omzetting", ondernemingId, herlaad],
    enabled: !!ondernemingId,
    queryFn: async (): Promise<OpenOmzetting | null> => {
      const { data: opv } = await supabase.from("onderneming_opvolging").select("id,van_onderneming_id,naar_onderneming_id,soort,ingangsdatum").eq("naar_onderneming_id", ondernemingId!);
      const vanIds = (opv ?? []).map((o) => o.van_onderneming_id);
      const ids = [ondernemingId!, ...vanIds];
      const [{ data: pol }, { data: ond }] = await Promise.all([
        supabase.from("policies").select("id,onderneming_id,status,certificate_number").in("onderneming_id", ids),
        vanIds.length ? supabase.from("ondernemingen").select("id,naam").in("id", vanIds) : Promise.resolve({ data: [] as { id: string; naam: string }[] }),
      ]);
      const namen = Object.fromEntries((ond ?? []).map((o) => [o.id, o.naam]));
      return openOmzetting(ondernemingId!, (opv ?? []) as any, (pol ?? []) as any, namen);
    },
  });
}

/** Melding met knop om de polis van de voorganger over te nemen (zelfde route als Omzetten naar BV). */
export function OpenOmzettingMelding({ open, ond, onKlaar, tekst }: { open: OpenOmzetting; ond: Ond; onKlaar: () => void; tekst?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 break-words">{tekst ?? `BAV-nummer${open.certificaatnummer ? ` ${open.certificaatnummer}` : ""} wordt overgenomen van ${open.vanNaam}. De polis staat nog op ${open.vanNaam}; neem hem over om hier een certificaat te hebben.`}</span>
      <OmzettenNaarBv polis={{ id: open.policyId, certificate_number: open.certificaatnummer }} vanNaam={open.vanNaam} vasteNaar={ond}
        vasteDatum={open.ingangsdatum} vasteReden={open.reden} knopTekst="Polis overnemen" onKlaar={onKlaar} />
    </div>
  );
}
