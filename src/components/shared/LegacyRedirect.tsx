import { useEffect } from "react";
import { Navigate } from "react-router-dom";

/** Querystrings en fragmenten veranderen het soort bestand niet. */
export function isStatischLegacyDoel(to: string): boolean {
  return /\.(png|jpg|jpeg|webp|svg|gif|pdf|ico|txt|xml)$/i.test(to.split(/[?#]/, 1)[0]);
}

export function navigeerLegacyBestand(to: string, replace: (url: string) => void): boolean {
  if (!isStatischLegacyDoel(to)) return false;
  replace(to);
  return true;
}

/** Bestanden moeten door de server worden geleverd, niet door de SPA-router. */
export function LegacyRedirect({ to }: { to: string }) {
  const bestand = isStatischLegacyDoel(to);
  useEffect(() => {
    if (bestand) navigeerLegacyBestand(to, url => window.location.replace(url));
  }, [to, bestand]);
  return bestand ? null : <Navigate to={to} replace />;
}