import { Fragment } from "react";
import { Link } from "react-router-dom";
import { CYBER_VOORWAARDEN_PAD } from "@/config/cyberPubliek";

/** Linkt alleen de voorwaardenverwijzing, zonder andere woorden te veranderen. */
export function CyberVoorwaardenTekst({ tekst }: { tekst: string }) {
  return <>{tekst.split(/(zpzaken\.nl\/voorwaarden#cyber)/g).map((deel, i) => deel === "zpzaken.nl/voorwaarden#cyber"
    ? <Link key={i} to={CYBER_VOORWAARDEN_PAD} className="underline underline-offset-4">{deel}</Link>
    : <Fragment key={i}>{deel}</Fragment>)}</>;
}