// Logica voor exact-stamdata-bijwerken (eenmalige uitzondering op A5, akkoord Boy 13 okt 2026).
// Nooit bestaande gegevens in Exact overschrijven of verwijderen.
// Toegestane schrijfacties (alleen hier gecontroleerd): PUT crm/Accounts(guid'…') met uitsluitend Phone,
// POST crm/BankAccounts en POST cashflow/DirectDebitMandates. Alles anders gooit een fout.
// Geen imports: ook getest met vitest (src/test/exactStamdata.test.ts).

// deno-lint-ignore no-explicit-any
type Any = any;
export type Exact = (methode: "GET" | "PUT" | "POST", pad: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; data: Any; tekst: string }>;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const guidOk = (g: unknown) => typeof g === "string" && GUID.test(g);
export const normIban = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toUpperCase();
export const leeg = (v: unknown) => v == null || String(v).trim() === "";
export const codeFilter = (code: string) => `Code eq '${code.trim().padStart(18, " ").replace(/'/g, "''")}'`;

/** Gooit als een schrijfactie niet expliciet is toegestaan. */
export function controleerSchrijfactie(methode: string, pad: string, body?: Record<string, unknown>) {
  if (methode === "GET") return;
  const sleutels = Object.keys(body ?? {});
  if (methode === "PUT") {
    const m = pad.match(/^crm\/Accounts\(guid'([0-9a-f-]{36})'\)$/i);
    if (m && guidOk(m[1]) && sleutels.length === 1 && sleutels[0] === "Phone") return;
  }
  if (methode === "POST" && (pad === "crm/BankAccounts" || pad === "cashflow/DirectDebitMandates")) return;
  throw new Error(`Niet toegestane Exact-schrijfactie: ${methode} ${pad} [${sleutels.join(",")}]`);
}

/** Wikkel een ruwe Exact-aanroep in de allowlist. */
export const beveiligd = (ruw: Exact): Exact => async (methode, pad, body) => {
  controleerSchrijfactie(methode, pad, body);
  return await ruw(methode, pad, body);
};

const res = (d: Any) => d?.d?.results ?? (d?.d && !Array.isArray(d.d) ? [d.d] : []);
const kort = (r: { status: number; tekst: string }, wat: string) => `${wat} ${r.status}: ${String(r.tekst ?? "").slice(0, 300)}`;

async function zoekAccount(ex: Exact, relatiecode: string) {
  const r = await ex("GET", `crm/Accounts?$filter=${encodeURIComponent(codeFilter(relatiecode))}&$select=ID,Code,Name,Phone`);
  if (!r.ok) return { fout: kort(r, "GET account") };
  const lijst = res(r.data);
  if (lijst.length === 0) return { niet: true };
  if (lijst.length > 1) return { fout: `${lijst.length} accounts met deze code` };
  if (!guidOk(lijst[0].ID)) return { fout: "Ongeldig account-ID" };
  return { acc: lijst[0] as { ID: string; Name: string; Phone: string | null } };
}

// ───────────── Telefoon ─────────────
export type TelRij = { id: string; relatiecode: string; telefoon: string; status: string; exact_account_id?: string | null };
export type Patch = Record<string, unknown> & { status: string };

export async function verwerkTelefoon(ex: Exact, rij: TelRij, live: boolean): Promise<Patch> {
  const tel = String(rij.telefoon ?? "").trim();
  if (!tel) return { status: "fout", melding: "Leeg telefoonnummer in import" };
  const a = await zoekAccount(ex, rij.relatiecode);
  if (a.fout) return { status: "fout", melding: a.fout };
  if (a.niet || !a.acc) return { status: "niet_gevonden", melding: "Relatiecode niet gevonden in Exact" };
  const acc = a.acc;
  const basis = { exact_account_id: acc.ID, exact_telefoon_oud: acc.Phone ?? null };
  if (!leeg(acc.Phone)) return { ...basis, status: "overgeslagen_heeft_al", melding: "Telefoon in Exact is al gevuld" };
  if (!live) return { ...basis, status: "proef_ok", melding: `Zou Phone zetten op ${tel}` };
  // Vlak voor de PUT opnieuw controleren dat het veld nog leeg is.
  const c = await ex("GET", `crm/Accounts(guid'${acc.ID}')?$select=ID,Phone`);
  if (!c.ok) return { ...basis, status: "fout", melding: kort(c, "GET controle") };
  const nu = res(c.data)[0]?.Phone ?? null;
  if (!leeg(nu)) return { ...basis, exact_telefoon_oud: nu, status: "overgeslagen_heeft_al", melding: "Telefoon is inmiddels gevuld in Exact" };
  const p = await ex("PUT", `crm/Accounts(guid'${acc.ID}')`, { Phone: tel });
  if (!p.ok) return { ...basis, status: "fout", melding: kort(p, "PUT telefoon") };
  return { ...basis, status: "bijgewerkt", melding: `Phone gezet op ${tel}` };
}

// ───────────── Machtigingen ─────────────
export type MandaatRij = { id: string; relatiecode: string; iban: string; kenmerk: string | null; ondertekend_op: string | null };

export async function verwerkMandaat(ex: Exact, rij: MandaatRij, live: boolean): Promise<Patch> {
  const kenmerk = String(rij.kenmerk ?? "").trim();
  if (!kenmerk) return { status: "fout", melding: "Geen kenmerk in klant_mandaten" };
  if (!rij.ondertekend_op) return { status: "fout", melding: "Geen tekendatum in klant_mandaten" };
  const iban = normIban(rij.iban);
  if (!iban) return { status: "fout", melding: "Geen IBAN" };
  const a = await zoekAccount(ex, rij.relatiecode);
  if (a.fout) return { status: "fout", melding: a.fout };
  if (a.niet || !a.acc) return { status: "niet_gevonden", melding: "Relatiecode niet gevonden in Exact" };
  const acc = a.acc;
  const basis: Record<string, unknown> = { exact_account_id: acc.ID };

  const mr = await ex("GET", `cashflow/DirectDebitMandates?$filter=${encodeURIComponent(`Account eq guid'${acc.ID}'`)}&$select=ID,Reference,BankAccount`);
  if (!mr.ok) return { ...basis, status: "fout", melding: kort(mr, "GET mandaten") };
  const mandaten: Any[] = res(mr.data);
  const zelfde = mandaten.find((m) => String(m.Reference ?? "").trim() === kenmerk);
  if (zelfde) return { ...basis, exact_mandaat_id: zelfde.ID ?? null, status: "overgeslagen_bestaat_al", melding: "Machtiging met dit kenmerk bestaat al in Exact", _bestaat: true };

  const br = await ex("GET", `crm/BankAccounts?$filter=${encodeURIComponent(`Account eq guid'${acc.ID}'`)}&$select=ID,BankAccount,Main`);
  if (!br.ok) return { ...basis, status: "fout", melding: kort(br, "GET bankrekeningen") };
  const banks: Any[] = res(br.data);
  const match = banks.find((b) => normIban(b.BankAccount) === iban);
  const hoofd = mandaten.length === 0;

  if (!live) return { ...basis, status: "proef_ok", exact_bankrekening_actie: match ? "bestaand" : "aanmaken",
    exact_bankrekening_id: match?.ID ?? null,
    melding: `Zou machtiging ${kenmerk} aanmaken${match ? "" : " en bankrekening toevoegen"}${hoofd ? " (hoofdmachtiging)" : ""}` };

  let bankId: string | null = match?.ID ?? null;
  let actie = match ? "bestaand" : "aangemaakt";
  if (!bankId) {
    const payload: Record<string, unknown> = { Account: acc.ID, BankAccount: iban, BankAccountHolderName: acc.Name };
    if (banks.some((b) => b.Main === true)) payload.Main = false; // bestaande hoofdrekening nooit vervangen
    const pb = await ex("POST", "crm/BankAccounts", payload);
    if (!pb.ok) return { ...basis, status: "fout", melding: kort(pb, "POST bankrekening") };
    bankId = res(pb.data)[0]?.ID ?? null;
    if (!guidOk(bankId)) return { ...basis, status: "fout", melding: "Bankrekening aangemaakt zonder ID in antwoord" };
  }
  const body: Record<string, unknown> = {
    Account: acc.ID, BankAccount: bankId, Reference: kenmerk,
    SignatureDate: `${rij.ondertekend_op}T00:00:00`, Type: 0, PaymentType: 1,
  };
  if (hoofd) body.Main = true;
  const pm = await ex("POST", "cashflow/DirectDebitMandates", body);
  if (!pm.ok) return { ...basis, exact_bankrekening_id: bankId, exact_bankrekening_actie: actie, status: "fout", melding: kort(pm, "POST machtiging") };
  return { ...basis, exact_bankrekening_id: bankId, exact_bankrekening_actie: actie,
    exact_mandaat_id: res(pm.data)[0]?.ID ?? null, status: "bijgewerkt", melding: `Machtiging ${kenmerk} aangemaakt`, _bestaat: true };
}
