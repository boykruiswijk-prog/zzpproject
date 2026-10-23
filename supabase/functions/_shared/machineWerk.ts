// Echte werkperiodes voor het live-scherm: machine_start bij begin, machine_klaar bij eind.
// Mag de functie nooit laten falen; teksten zijn vast en bevatten nooit klantgegevens.
import { createClient } from "npm:@supabase/supabase-js@2";

export type WerkConfig = { station: string; actie: string; tekst: string; klaarTekst?: string; foutTekst?: string; bron: string };
export type Werk = { start: () => Promise<void> };

/**
 * Omhult een handler. De handler roept `werk.start()` aan zodra het echte werk begint
 * (na de toegangscontrole), zodat geweigerde of lege aanroepen geen werkplek laten oplichten.
 * Bij afloop sluit de wrapper de rij af: klaar bij elk antwoord onder 500 (een afgewezen invoer is geen storing), anders fout.
 */
const lopend = new WeakMap<Request, Werk>();
/** Werk van deze aanroep; buiten metWerk een lege stub. */
export function werkVan(req: Request): Werk { return lopend.get(req) ?? { start: async () => {} }; }

export function metWerk(cfg: WerkConfig, handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    let id: string | null = null;
    let admin: { rpc: (name: string, args: Record<string, string>) => PromiseLike<unknown> } | null = null;
    const werk: Werk = {
      start: async () => {
        if (id) return;
        try {
          const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
          admin = client;
          const { data } = await client.rpc("machine_start", { _station: cfg.station, _actie: cfg.actie, _tekst: cfg.tekst, _bron: cfg.bron });
          id = typeof data === "string" ? data : null;
        } catch (e) { console.error("machine_start", String((e as Error)?.message ?? e)); }
      },
    };
    const sluit = async (ok: boolean) => {
      if (!id || !admin) return;
      try {
        await admin.rpc("machine_klaar", { _id: id, _status: ok ? "klaar" : "fout", _tekst: ok ? (cfg.klaarTekst ?? cfg.tekst) : (cfg.foutTekst ?? cfg.tekst) });
      } catch (e) { console.error("machine_klaar", String((e as Error)?.message ?? e)); }
    };
    lopend.set(req, werk);
    try {
      const res = await handler(req);
      await sluit(res.status < 500);
      return res;
    } catch (e) {
      await sluit(false);
      throw e;
    }
  };
}
