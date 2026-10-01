// Controleert met de anon-key: gepubliceerde artikelen en artikelafbeeldingen zijn leesbaar,
// concepten en teamdata niet. Gebruik: node scripts/check-anon-kennisbank.mjs
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const U = env.VITE_SUPABASE_URL, K = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const h = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const get = async (p) => { const r = await fetch(`${U}/rest/v1/${p}`, { headers: h }); return [r.status, await r.json()]; };
let fail = 0; const ok = (c, m) => { console.log(`${c ? "OK  " : "FOUT"} ${m}`); if (!c) fail++; };
const [s1, pub] = await get("articles?select=slug&is_published=eq.true");
ok(s1 === 200 && pub.length > 0, `gepubliceerde artikelen leesbaar (${s1}, ${pub.length})`);
const [s2, con] = await get("articles?select=slug&is_published=not.eq.true");
ok(s2 === 200 && con.length === 0, `concepten onzichtbaar (${s2}, ${Array.isArray(con) ? con.length : "?"})`);
const st = await fetch(`${U}/storage/v1/object/list/article-images`, { method: "POST", headers: h, body: JSON.stringify({ prefix: "", limit: 5 }) });
ok(st.ok, `artikelafbeeldingen leesbaar (${st.status})`);
for (const t of ["leads", "invoices", "policies", "dba_checks"]) {
  const [s, rows] = await get(`${t}?select=id&limit=1`);
  ok(!Array.isArray(rows) || rows.length === 0, `${t} niet leesbaar voor anon (${s})`);
}
process.exit(fail ? 1 : 0);
