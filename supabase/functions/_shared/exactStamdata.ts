// Logica voor exact-stamdata-bijwerken (eenmalige uitzondering op A5, akkoord Boy 13 okt 2026).
// Nooit bestaande gegevens in Exact overschrijven of verwijderen.
// Toegestane schrijfacties (alleen hier gecontroleerd): PUT crm/Accounts(guid'…') met uitsluitend Phone of
// uitsluitend PaymentConditionSales, POST crm/BankAccounts, POST cashflow/DirectDebitMandates en
// PUT cashflow/DirectDebitMandates(guid'…') met uitsluitend Main = true. Alles anders gooit een fout.
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
    if (m && guidOk(m[1]) && sleutels.length === 1 && (sleutels[0] === "Phone" || sleutels[0] === "PaymentConditionSales")) return;
    const d = pad.match(/^cashflow\/DirectDebitMandates\(guid'([0-9a-f-]{36})'\)$/i);
    if (d && guidOk(d[1]) && sleutels.length === 1 && sleutels[0] === "Main" && body?.Main === true) return;
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

// ───────────── Controle (alleen GET) ─────────────
export const maskIban = (s: unknown) => { const i = normIban(s); return i.length <= 8 ? (i ? "****" : null) : `${i.slice(0, 4)}…${i.slice(-4)}`; };
export const exactDatum = (v: unknown): string | null => {
  const m = typeof v === "string" ? v.match(/\/Date\((-?\d+)\)\//) : null;
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);
};
const vandaag = () => new Date().toISOString().slice(0, 10);
const isIncasso = (c: unknown) => String(c ?? "").trim().toUpperCase() === "IN";

export function signalen(r: Any): string[] {
  const s: string[] = [];
  const mand: Any[] = r.mandaten ?? [];
  const actief = mand.filter((m) => !m.CancellationDate || m.CancellationDate > vandaag());
  if (mand.length === 0) s.push("geen mandaat in Exact");
  if (mand.length > 0 && r.account && !isIncasso(r.account.betalingsconditie_code)) s.push(`mandaat bestaat maar SalesPaymentCondition is geen incasso (${r.account.betalingsconditie_code ?? "leeg"})`);
  for (const m of mand) {
    if (m.CancellationDate && m.CancellationDate <= vandaag()) s.push(`mandaat ${m.Reference} ingetrokken (CancellationDate ${m.CancellationDate})`);
    if (!m.Main) s.push(`mandaat ${m.Reference} niet Main`);
  }
  if (mand.length > 0 && actief.length === 0) s.push("geen actief mandaat");
  if (actief.length === 1 && actief[0].Main === false) s.push(`enige geldige mandaat ${actief[0].Reference} staat niet op Main`);
  const hoofd = (r.bankrekeningen ?? []).find((b: Any) => b.Main);
  for (const m of actief) if (hoofd && m.bankrekening_id && m.bankrekening_id !== hoofd.id) s.push(`mandaat ${m.Reference} verwijst naar andere bankrekening (${m.bankrekening}) dan de hoofdrekening (${hoofd.iban})`);
  for (const f of r.facturen ?? []) if (!isIncasso(f.PaymentCondition)) s.push(`factuur ${f.InvoiceNumber} met betalingsconditie ≠ IN (${f.PaymentCondition ?? "leeg"})`);
  if (r.account?.Blocked) s.push("account geblokkeerd");
  return s;
}

export async function controleerRelatie(ex: Exact, relatiecode: string): Promise<Any> {
  const ro: Exact = (m, p, b) => { if (m !== "GET") throw new Error("Controle mag alleen GET doen"); return ex(m, p, b); };
  const fouten: string[] = [];
  const r = await ro("GET", `crm/Accounts?$filter=${encodeURIComponent(codeFilter(relatiecode))}&$select=ID,Code,Name,Status,Blocked,PaymentConditionSales,PaymentConditionSalesDescription`);
  if (!r.ok) return { relatiecode, fouten: [kort(r, "GET account")], signalen: [] };
  const accs = res(r.data);
  if (accs.length !== 1 || !guidOk(accs[0].ID)) return { relatiecode, fouten: [accs.length ? `${accs.length} accounts met deze code` : "niet gevonden"], signalen: ["account niet (eenduidig) gevonden"] };
  const a = accs[0];
  const id = a.ID;
  const get = async (pad: string, wat: string) => { const x = await ro("GET", pad); if (!x.ok) { fouten.push(kort(x, wat)); return []; } return res(x.data); };
  const banks = (await get(`crm/BankAccounts?$filter=${encodeURIComponent(`Account eq guid'${id}'`)}&$select=ID,BankAccount,Main,Blocked`, "GET bankrekeningen"))
    .map((b: Any) => ({ id: b.ID, iban: maskIban(b.BankAccount), Main: b.Main ?? null, Blocked: b.Blocked ?? null }));
  const bankMap = new Map(banks.map((b: Any) => [b.id, b.iban]));
  const mandaten = (await get(`cashflow/DirectDebitMandates?$filter=${encodeURIComponent(`Account eq guid'${id}'`)}&$select=ID,Reference,Type,PaymentType,SignatureDate,CancellationDate,FirstSend,Main,BankAccount`, "GET mandaten"))
    .map((m: Any) => ({ Reference: m.Reference ?? null, Type: m.Type ?? null, PaymentType: m.PaymentType ?? null,
      SignatureDate: exactDatum(m.SignatureDate), CancellationDate: exactDatum(m.CancellationDate), FirstSend: m.FirstSend ?? null,
      Main: m.Main ?? null, bankrekening_id: m.BankAccount ?? null, bankrekening: bankMap.get(m.BankAccount) ?? "onbekende rekening" }));
  const facturen = (await get(`salesinvoice/SalesInvoices?$filter=${encodeURIComponent(`InvoiceTo eq guid'${id}'`)}&$select=InvoiceNumber,InvoiceDate,PaymentCondition,Status,AmountDC,Journal&$orderby=InvoiceDate desc&$top=10`, "GET facturen"))
    .map((f: Any) => ({ InvoiceNumber: f.InvoiceNumber, InvoiceDate: exactDatum(f.InvoiceDate), PaymentCondition: f.PaymentCondition ?? null, Status: f.Status ?? null, AmountDC: f.AmountDC ?? null, Journal: f.Journal ?? null }));
  const open = (await get(`read/financial/ReceivablesList?$filter=${encodeURIComponent(`AccountId eq guid'${id}'`)}&$select=InvoiceNumber,Amount,DueDate`, "GET openstaande posten"))
    .map((o: Any) => ({ factuurnummer: o.InvoiceNumber ?? null, bedrag: o.Amount ?? null, vervaldatum: exactDatum(o.DueDate) }));
  const uit: Any = {
    relatiecode,
    account: { ID: id, Code: String(a.Code ?? "").trim(), Name: a.Name, Status: a.Status ?? null, Blocked: a.Blocked ?? null,
      betalingsconditie_code: a.PaymentConditionSales ?? null, betalingsconditie_omschrijving: a.PaymentConditionSalesDescription ?? null },
    bankrekeningen: banks, mandaten, facturen, openstaande_posten: open, fouten,
  };
  uit.signalen = signalen(uit);
  return uit;
}

// ───────────── Betaalconditie en mandaat_main ─────────────
export const INCASSO_CODE = "IN";
const geldigMandaat = (m: Any) => { const d = exactDatum(m.CancellationDate); return !d || d > vandaag(); };

/** Controleert in cashflow/PaymentConditions dat 'IN' de incassoconditie is. Gooit als dat niet zeker is. */
export async function bevestigIncassoCode(ex: Exact): Promise<{ code: string; omschrijving: string; methode: string | null }> {
  const r = await ex("GET", `cashflow/PaymentConditions?$select=Code,Description,PaymentMethod`);
  if (!r.ok) throw new Error(kort(r, "GET PaymentConditions"));
  const c = res(r.data).find((x: Any) => String(x.Code ?? "").trim().toUpperCase() === INCASSO_CODE);
  if (!c) throw new Error("Betalingsconditie 'IN' bestaat niet in Exact; gestopt");
  const methode = c.PaymentMethod == null ? null : String(c.PaymentMethod).trim().toUpperCase();
  // Exact PaymentMethod: B = op rekening, I = incasso, K = contant.
  if (methode !== null && methode !== "I") throw new Error(`Conditie 'IN' heeft PaymentMethod '${methode}', niet incasso (I); gestopt`);
  if (methode === null && !/incasso|automatisch|collect/i.test(String(c.Description ?? ""))) throw new Error(`Conditie 'IN' (${c.Description}) is niet zeker incasso; gestopt`);
  return { code: INCASSO_CODE, omschrijving: String(c.Description ?? ""), methode };
}

async function leesAccountEnMandaten(ex: Exact, accountId: string) {
  const a = await ex("GET", `crm/Accounts(guid'${accountId}')?$select=ID,Code,PaymentConditionSales`);
  if (!a.ok) return { fout: a.status === 404 ? "niet_gevonden" : kort(a, "GET account") };
  const acc = res(a.data)[0];
  if (!acc) return { fout: "niet_gevonden" };
  const m = await ex("GET", `cashflow/DirectDebitMandates?$filter=${encodeURIComponent(`Account eq guid'${accountId}'`)}&$select=ID,Reference,CancellationDate,Main`);
  if (!m.ok) return { fout: kort(m, "GET mandaten") };
  const geldig = res(m.data).filter(geldigMandaat);
  return { conditie: acc.PaymentConditionSales == null ? null : String(acc.PaymentConditionSales).trim(), geldig };
}

export type BcRij = { relatiecode: string; exact_account_id: string; wacht_op_mandaat?: boolean };

export async function verwerkBetaalconditie(ex: Exact, rij: BcRij, live: boolean): Promise<Patch> {
  if (!guidOk(rij.exact_account_id)) return { status: "fout", melding: "Ongeldig exact_account_id" };
  const l = await leesAccountEnMandaten(ex, rij.exact_account_id);
  if (l.fout === "niet_gevonden") return { status: "niet_gevonden", melding: "Account niet gevonden in Exact" };
  if (l.fout) return { status: "fout", melding: l.fout };
  const basis = { conditie_oud: l.conditie };
  const signaal = l.geldig!.length === 1 && l.geldig![0].Main === false ? " Signaal: enige geldige mandaat staat niet op Main." : "";
  if ((l.conditie ?? "").toUpperCase() === INCASSO_CODE) return { ...basis, status: "al_incasso", melding: `Conditie staat al op IN.${signaal}`.trim() };
  if (l.geldig!.length === 0) {
    if (!live && rij.wacht_op_mandaat) return { ...basis, status: "wacht_op_mandaat", melding: "Machtiging wordt eerst aangemaakt; daarna opnieuw gecontroleerd" };
    return { ...basis, status: "geen_mandaat", melding: "Geen geldig mandaat; niet aangepast" };
  }
  if (!live) return { ...basis, status: "proef_ok", melding: `Zou conditie ${l.conditie ?? "leeg"} → IN zetten.${signaal}` };
  const p = await ex("PUT", `crm/Accounts(guid'${rij.exact_account_id}')`, { PaymentConditionSales: INCASSO_CODE });
  if (!p.ok) return { ...basis, status: "fout", melding: kort(p, "PUT betaalconditie") };
  return { ...basis, status: "bijgewerkt", melding: `Conditie ${l.conditie ?? "leeg"} → IN.${signaal}`.trim() };
}

export async function verwerkMandaatMain(ex: Exact, rij: BcRij, live: boolean): Promise<Patch> {
  if (!guidOk(rij.exact_account_id)) return { status: "fout", melding: "Ongeldig exact_account_id" };
  const l = await leesAccountEnMandaten(ex, rij.exact_account_id);
  if (l.fout === "niet_gevonden") return { status: "niet_gevonden", melding: "Account niet gevonden in Exact" };
  if (l.fout) return { status: "fout", melding: l.fout };
  const g = l.geldig!;
  if (g.length === 0) return { status: "geen_mandaat", melding: "Geen geldig mandaat" };
  if (g.length > 1) return { status: "niet_van_toepassing", melding: `${g.length} geldige mandaten; Main niet automatisch gekozen` };
  const m = g[0];
  if (m.Main !== false) return { status: "al_main", exact_mandaat_id: m.ID, melding: "Enige geldige mandaat staat al op Main" };
  if (!guidOk(m.ID)) return { status: "fout", melding: "Ongeldig mandaat-ID" };
  if (!live) return { status: "proef_ok", exact_mandaat_id: m.ID, melding: `Zou mandaat ${m.Reference} op Main zetten` };
  const p = await ex("PUT", `cashflow/DirectDebitMandates(guid'${m.ID}')`, { Main: true });
  if (!p.ok) return { status: "fout", exact_mandaat_id: m.ID, melding: kort(p, "PUT Main") };
  return { status: "bijgewerkt", exact_mandaat_id: m.ID, melding: `Mandaat ${m.Reference} op Main gezet` };
}
