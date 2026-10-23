// Read-only live check: never creates a request, activates a policy, or sends mail.
import fs from "node:fs";
import assert from "node:assert/strict";
const config = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(s => s.includes("=")).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1).replace(/^"|"$/g, "")]; }));
const url = config.VITE_SUPABASE_URL, key = config.VITE_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const read = await fetch(`${url}/rest/v1/cyber_toevoeg_verzoeken?select=id`, { headers });
assert.ok([401,403].includes(read.status), `Anonymous reading must be denied (${read.status})`);
for (const fn of ["cyber_toevoegen_opties", "cyber_toevoegen_beoordelen"]) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: fn.endsWith("beoordelen") ? JSON.stringify({ _id:"00000000-0000-0000-0000-000000000001", _akkoord:false, _notitie:"Anonymous access probe" }) : "{}" });
  assert.ok([401,403,404].includes(r.status), `Anonymous RPC ${fn} must be denied (${r.status})`);
}
console.log("3/3 anonymous cyber access checks passed; no writes.");