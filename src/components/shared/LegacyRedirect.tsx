import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { zoekLegacyDoel } from "@/config/legacyRedirects";

/** Querystrings en fragmenten veranderen het soort bestand niet. */
export function isStatischLegacyDoel(to: string): boolean {
  return /\.(png|jpg|jpeg|webp|svg|gif|pdf|ico|txt|xml)$/i.test(to.split(/[?#]/, 1)[0]);
}

export function navigeerLegacyBestand(to: string, replace: (url: string) => void, volledig = false): boolean {
  if (!volledig && !isStatischLegacyDoel(to)) return false;
  replace(to);
  return true;
}

/** Bestanden moeten door de server worden geleverd, niet door de SPA-router. */
export function LegacyRedirect({ to: template, volledig = false }: { to: string; volledig?: boolean }) {
  const location = useLocation();
  const to = template.includes(":splat") ? (zoekLegacyDoel(location.pathname) ?? template) : template;
  const bestand = volledig || isStatischLegacyDoel(to);
  useEffect(() => {
    if (bestand) navigeerLegacyBestand(to, url => window.location.replace(url), volledig);
  }, [to, bestand, volledig]);
  return bestand ? null : <Navigate to={to} replace />;
}