import { readFileSync } from "node:fs";
import { CYBER_AKKOORD } from "../supabase/functions/_shared/cyber";

/** Preserve trigger validation/effects; only regenerate the new evidence text. */
export function cyberAkkoordSql(): string {
  const source = readFileSync("drizzle/migrations/0086_cyber_evidence_and_exact_lead_link.sql", "utf8");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.leg_cyber_aanvraag_vast()");
  const end = source.indexOf("END $$;", start) + "END $$;".length;
  if (start < 0 || end <= start) throw new Error("Cyber trigger source missing");
  return source.slice(start, end).replace(/v_tekst text:='[^']*'/, `v_tekst text:='${CYBER_AKKOORD.replace(/'/g, "''")}'`) +
    "\nREVOKE ALL ON FUNCTION public.leg_cyber_aanvraag_vast() FROM PUBLIC, anon, authenticated;\n";
}

/** E6 stays byte-identical; only new requests use the generated consent. */
export function cyberToevoegenAkkoordSql(): string {
  const source = readFileSync("drizzle/migrations/0176_cyber_terugwerkend_alleen_ellen.sql", "utf8");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen(");
  if (start < 0) throw new Error("Cyber request source missing");
  return source.slice(start).replace(/'Ik begrijp dat cyber[^']*'/, `'${CYBER_AKKOORD.replace(/'/g, "''")}'`) +
    "\nREVOKE ALL ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) TO authenticated;\n";
}