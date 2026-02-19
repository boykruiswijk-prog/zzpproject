import { useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

/**
 * Maps old WordPress URLs (indexed by Google) to new Lovable routes.
 */
const REDIRECT_MAP: Record<string, string> = {
  "/belastingen": "/kennisbank",
  "/ondernemen": "/kennisbank",
  "/financien": "/kennisbank",
  "/verzekeringen-info": "/kennisbank",
  "/movir": "/verzekeringen",
  "/wijzijnaov": "/verzekeringen",
  "/aov-via-centraalbeheer": "/verzekeringen",
  "/sharepeople": "/partners",
  "/eherkenning": "/kennisbank",
  "/verplichte-aov-voor-zzp": "/kennisbank/aov-arbeidsongeschiktheidsverzekering",
  "/nieuwe-regels-zzp": "/kennisbank/nieuwe-regels-zzp-2025",
  "/hoeveel-opdrachtgevers-zzp": "/kennisbank",
  "/alles-over-een-zzp-factuur": "/kennisbank",
  "/inschrijven-bij-de-kamer-van-koophandel": "/kennisbank",
  "/zzp-administratie-en-boekhouding": "/diensten#administratie",
  "/hoe-bereken-ik-bijtelling-als-zzper": "/kennisbank",
  "/is-eten-en-drinken-aftrekbaar-als-zzp-er": "/kennisbank",
  "/winkel": "/",
  "/shop": "/",
  "/product": "/",
  "/mijn-account": "/",
  "/my-account": "/",
};

const NotFound = () => {
  const location = useLocation();
  const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, "") || "/";
  const redirect = REDIRECT_MAP[normalizedPath];

  useEffect(() => {
    if (!redirect) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname, redirect]);

  // Redirect old WordPress URLs
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Pagina niet gevonden | ZP Zaken</title>
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Deze pagina bestaat niet (meer)</p>
        <p className="mb-6 text-muted-foreground">Mogelijk is de pagina verplaatst of verwijderd.</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Terug naar de homepage
        </a>
      </div>
    </div>
  );
};

export default NotFound;
