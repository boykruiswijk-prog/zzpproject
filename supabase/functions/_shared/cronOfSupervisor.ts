// Toegang voor dagelijkse runs: cron (x-cron-secret uit Vault) of een supervisor/admin.
// deno-lint-ignore-file no-explicit-any
import { requireSupervisor } from "./teamAuth.ts";

export async function cronOfSupervisor(req: Request, admin: any): Promise<{ cron: boolean } | Response> {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { p_secret: cron });
    if (ok === true) return { cron: true };
  }
  const auth = await requireSupervisor(req, admin);
  if (auth instanceof Response) return auth;
  return { cron: false };
}

export const vandaagNL = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
export const uurNL = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(new Date()));
