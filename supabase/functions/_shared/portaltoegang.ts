// deno-lint-ignore-file no-explicit-any
// Loginpoging op Mijn ZP zonder toegang: interne aanvraag "portaltoegang" met mogelijke match.
// Geen mail naar de bezoeker; maximaal één open aanvraag per adres per 24 uur.
const ALGEMEEN = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.nl", "live.com", "hotmail.nl", "icloud.com", "yahoo.com", "ziggo.nl", "kpnmail.nl", "planet.nl", "xs4all.nl", "home.nl", "me.com", "msn.com", "upcmail.nl"]);

export function domeinVan(email: string): string | null {
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  return d && !ALGEMEEN.has(d) ? d : null;
}

export async function meldPortaltoegang(admin: any, email: string, heeftAccount: boolean) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin.from("klant_service_aanvragen").select("id", { count: "exact", head: true })
    .eq("type", "portaltoegang").eq("email", email).gte("created_at", since);
  if ((count ?? 0) > 0) return;
  const matches: any[] = [];
  const { data: exact } = await admin.from("personen").select("id,voornaam,achternaam,email_weergave").eq("genormaliseerd_email", email).eq("is_test", false).limit(3);
  for (const p of exact ?? []) matches.push({ soort: "persoon_email", persoon_id: p.id, naam: [p.voornaam, p.achternaam].filter(Boolean).join(" "), email: p.email_weergave });
  const { data: fe } = await admin.from("ondernemingen").select("id,naam").ilike("factuur_email", email).eq("is_test", false).limit(3);
  for (const o of fe ?? []) matches.push({ soort: "factuur_email", onderneming_id: o.id, naam: o.naam });
  const dom = domeinVan(email);
  if (dom && matches.length === 0) {
    const { data: dp } = await admin.from("personen").select("id,voornaam,achternaam,email_weergave").ilike("genormaliseerd_email", `%@${dom}`).eq("is_test", false).limit(5);
    for (const p of dp ?? []) matches.push({ soort: "zelfde_domein", persoon_id: p.id, naam: [p.voornaam, p.achternaam].filter(Boolean).join(" "), email: p.email_weergave });
  }
  let ondId: string | null = matches.find((m) => m.onderneming_id)?.onderneming_id ?? null;
  const persIds = matches.map((m) => m.persoon_id).filter(Boolean);
  if (persIds.length) {
    const { data: po } = await admin.from("persoon_onderneming").select("persoon_id,onderneming_id,ondernemingen(naam)").in("persoon_id", persIds);
    for (const m of matches) {
      const r = (po ?? []).find((x: any) => x.persoon_id === m.persoon_id);
      if (r) { m.onderneming_id = r.onderneming_id; m.bedrijf = r.ondernemingen?.naam; }
    }
    ondId = ondId ?? (po ?? [])[0]?.onderneming_id ?? null;
  }
  await admin.from("klant_service_aanvragen").insert({
    type: "portaltoegang", voornaam: "", achternaam: "", email, telefoon: "", polisnummer: "",
    details: { bron: "portal_login", heeft_account: heeftAccount, mogelijke_match: matches, bedrijfsnaam: matches.find((m) => m.bedrijf)?.bedrijf ?? matches.find((m) => m.soort === "factuur_email")?.naam ?? null },
    status: "nieuw", onderneming_id: ondId, geverifieerd: false,
  });
}
