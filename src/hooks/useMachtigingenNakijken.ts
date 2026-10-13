import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MachtigingRij = { id: string; naam: string | null; relatiecode: string | null; kenmerk?: string | null; vervaldatum?: string | null };
export type MachtigingenNakijken = { niet_in_exact: MachtigingRij[]; zonder: MachtigingRij[]; verlopen: MachtigingRij[]; totaal: number };

/** Klanten met een machtiging om na te kijken (RPC machtigingen_nakijken, alleen team met 2FA). */
export function useMachtigingenNakijken() {
  return useQuery({
    queryKey: ["machtigingen-nakijken"],
    refetchInterval: 300_000,
    retry: false,
    queryFn: async (): Promise<MachtigingenNakijken> => {
      const { data, error } = await (supabase.rpc as any)("machtigingen_nakijken");
      if (error) throw error;
      const d = data as Omit<MachtigingenNakijken, "totaal">;
      const ids = new Set([...d.niet_in_exact, ...d.zonder, ...d.verlopen].map((r) => r.id));
      return { ...d, totaal: ids.size };
    },
  });
}
