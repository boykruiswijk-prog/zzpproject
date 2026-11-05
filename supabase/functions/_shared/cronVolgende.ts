// Eerstvolgende run van een pg_cron-schema (5 velden, UTC). Ondersteunt *, */n, a-b, a-b/n en lijsten.
function veld(expr: string, min: number, max: number): Set<number> | null {
  const uit = new Set<number>();
  for (const deel of expr.split(',')) {
    const [bereik, stapTekst] = deel.split('/');
    const stap = stapTekst ? Number(stapTekst) : 1;
    if (!Number.isInteger(stap) || stap < 1) return null;
    let van = min, tot = max;
    if (bereik !== '*') {
      const [a, b] = bereik.split('-').map(Number);
      if (!Number.isInteger(a)) return null;
      van = a; tot = b === undefined ? (stapTekst ? max : a) : b;
      if (!Number.isInteger(tot)) return null;
    }
    for (let x = van; x <= tot; x += stap) uit.add(x === 7 && max === 7 ? 0 : x);
  }
  return uit;
}

/** Geeft de eerstvolgende tijd (ISO) na `na`, of null bij een onbekend schema of niets binnen 8 dagen. */
export function volgendeRun(schema: string | null | undefined, na = new Date()): string | null {
  const v = typeof schema === 'string' ? schema.trim().split(/\s+/) : [];
  if (v.length !== 5) return null;
  const [mi, uu, dg, mn, wd] = [veld(v[0], 0, 59), veld(v[1], 0, 23), veld(v[2], 1, 31), veld(v[3], 1, 12), veld(v[4], 0, 7)];
  if (!mi || !uu || !dg || !mn || !wd) return null;
  const dagVrij = v[2] === '*', wdVrij = v[4] === '*';
  const t = new Date(na.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  for (let i = 0; i < 8 * 24 * 60; i++) {
    const dagOk = dagVrij && wdVrij ? true : dagVrij ? wd.has(t.getUTCDay()) : wdVrij ? dg.has(t.getUTCDate()) : dg.has(t.getUTCDate()) || wd.has(t.getUTCDay());
    if (mn.has(t.getUTCMonth() + 1) && dagOk && uu.has(t.getUTCHours()) && mi.has(t.getUTCMinutes())) return t.toISOString();
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}
