import { AdminAalGuard } from "@/components/admin/AdminAalGuard";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation } from "react-router-dom";
import { zetGaUitschakeling } from "@/lib/tracking";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
const Index = lazy(() => import("./pages/Index"));
const Diensten = lazy(() => import("./pages/Diensten"));
const Verzekeringen = lazy(() => import("./pages/Verzekeringen"));
const AOV = lazy(() => import("./pages/AOV"));
const Pensioen = lazy(() => import("./pages/Pensioen"));
const Zorgverzekering = lazy(() => import("./pages/Zorgverzekering"));
const ZzpVerzekeringICT = lazy(() => import("./pages/ZzpVerzekeringICT"));
const ZzpVerzekeringZorg = lazy(() => import("./pages/ZzpVerzekeringZorg"));
const ZzpVerzekeringBouw = lazy(() => import("./pages/ZzpVerzekeringBouw"));
const ZzpVerzekeringConsultant = lazy(() => import("./pages/ZzpVerzekeringConsultant"));
const ZzpVerzekeringInterimManager = lazy(() => import("./pages/ZzpVerzekeringInterimManager"));
const ZzpVerzekeringFinance = lazy(() => import("./pages/ZzpVerzekeringFinance"));
const ZzpVerzekeringHR = lazy(() => import("./pages/ZzpVerzekeringHR"));
const Starters = lazy(() => import("./pages/Starters"));
const ZzpVerzekeringMarketing = lazy(() => import("./pages/ZzpVerzekeringMarketing"));
const ZzpVerzekeringCoach = lazy(() => import("./pages/ZzpVerzekeringCoach"));
const MentaleGezondheid = lazy(() => import("./pages/MentaleGezondheid"));
const WaaromZpZaken = lazy(() => import("./pages/WaaromZpZaken"));
const VoorWie = lazy(() => import("./pages/VoorWie"));
const ZoWerkenWij = lazy(() => import("./pages/ZoWerkenWij"));
const Kennisbank = lazy(() => import("./pages/Kennisbank"));
const KennisbankWetEnRegelgeving = lazy(() => import("./pages/kennisbank/WetEnRegelgeving"));
const KennisbankOndernemen = lazy(() => import("./pages/kennisbank/Ondernemen"));
const KennisbankBelastingen = lazy(() => import("./pages/kennisbank/Belastingen"));
const KennisbankFinancien = lazy(() => import("./pages/kennisbank/Financien"));
const KennisbankVerzekeringen = lazy(() => import("./pages/kennisbank/Verzekeringen"));
const ArtikelDetail = lazy(() => import("./pages/ArtikelDetail"));
const OverOns = lazy(() => import("./pages/OverOns"));
const Partners = lazy(() => import("./pages/Partners"));
const Historie = lazy(() => import("./pages/Historie"));
const Contact = lazy(() => import("./pages/Contact"));
const Cookies = lazy(() => import("./pages/Cookies"));
const FAQ = lazy(() => import("./pages/FAQ"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CollectieveInkoop = lazy(() => import("./pages/CollectieveInkoop"));
const CollectiefLedenorganisaties = lazy(() => import("./pages/CollectiefLedenorganisaties"));
const SocialMedia = lazy(() => import("./pages/SocialMedia"));
const CreditControl = lazy(() => import("./pages/CreditControl"));
const Screening = lazy(() => import("./pages/Screening"));
const AdminScreeningAanvragen = lazy(() => import("./pages/admin/ScreeningAanvragen"));
const AdminScreeningAanvraagDetail = lazy(() => import("./pages/admin/ScreeningAanvraagDetailPage"));
const AdminServiceAanvragen = lazy(() => import("./pages/admin/ServiceAanvragen"));
const AdminBavNummerNakijken = lazy(() => import("./pages/admin/BavNummerNakijken"));
const AdminServiceAanvraagDetail = lazy(() => import("./pages/admin/ServiceAanvraagDetailPage"));
const AdminCRM = lazy(() => import("./pages/admin/CRM"));
const AdminActiviteiten = lazy(() => import("./pages/admin/Activiteiten"));
const AdminSocialMediaFeatures = lazy(() => import("./pages/admin/SocialMediaFeatures"));
const AdminIntegraties = lazy(() => import("./pages/admin/Integraties"));
const AdminExactKoppeling = lazy(() => import("./pages/admin/ExactKoppeling"));
const AdminInterneMeldingen = lazy(() => import("./pages/admin/InterneMeldingen"));
const AdminActiviteitenlog = lazy(() => import("./pages/admin/Activiteitenlog"));
const AdminMarketing = lazy(() => import("./pages/admin/MarketingPlaceholder"));
const AdminKennisbank = lazy(() => import("./pages/admin/KennisbankArtikelen"));
const AdminKennisbankEditor = lazy(() => import("./pages/admin/KennisbankArtikelEditor"));
const AdminKennisbankActualiteit = lazy(() => import("./pages/admin/KennisbankActualiteit"));
const AdminWpImport = lazy(() => import("./pages/admin/WpImport"));
const AdminNietGevonden = lazy(() => import("./pages/admin/NietGevonden"));
const BavZzpVergelijken = lazy(() => import("./pages/BavZzpVergelijken"));
const AdminAfgehaakt = lazy(() => import("./pages/admin/Afgehaakt"));
const AdminChatgesprekken = lazy(() => import("./pages/admin/Chatgesprekken"));
const AdminKlantenContracten = lazy(() => import("./pages/admin/KlantenContracten"));
const AdminKlantDetail = lazy(() => import("./pages/admin/KlantDetail"));
const AdminPersoonDetail = lazy(() => import("./pages/admin/PersoonDetail"));
const AdminExactReconciliatie = lazy(() => import("./pages/admin/ExactReconciliatie"));
const AdminFacturatieplanning = lazy(() => import("./pages/admin/Facturatieplanning"));
const ExactCallback = lazy(() => import("./pages/ExactCallback"));
const AdminLogin = lazy(() => import("./pages/admin/LoginPage"));
const ChangePasswordPage = lazy(() => import("./pages/admin/ChangePasswordPage"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminLeads = lazy(() => import("./pages/admin/Leads"));
const AdminLeadDetail = lazy(() => import("./pages/admin/LeadDetail"));
const AdminTeam = lazy(() => import("./pages/admin/Team"));
const AdminDbaChecks = lazy(() => import("./pages/admin/DbaChecks"));
const DbaCheckNew = lazy(() => import("./pages/admin/DbaCheckNew"));
const DbaCheckDetail = lazy(() => import("./pages/admin/DbaCheckDetail"));
const DbaCheckBulk = lazy(() => import("./pages/admin/DbaCheckBulk"));
const DbaCheckBatchDetail = lazy(() => import("./pages/admin/DbaCheckBatchDetail"));
const DbaVerificatie = lazy(() => import("./pages/DbaVerificatie"));
const ForgotPassword = lazy(() => import("./pages/admin/ForgotPasswordPage"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPasswordPage"));
const ScreenshotHelper = lazy(() => import("./pages/ScreenshotHelper"));
const AlgemeneVoorwaarden = lazy(() => import("./pages/AlgemeneVoorwaarden"));
const Klachtenprocedure = lazy(() => import("./pages/Klachtenprocedure"));
const Documenten = lazy(() => import("./pages/Documenten"));
const SlotverklaringPage = lazy(() => import("./pages/documenten/SlotverklaringPage"));
const DienstverleningsdocumentPage = lazy(() => import("./pages/documenten/DienstverleningsdocumentPage"));
const GedragscodePage = lazy(() => import("./pages/documenten/GedragscodePage"));
const OffertePage = lazy(() => import("./pages/OffertePage"));
const OfferteBedankt = lazy(() => import("./pages/OfferteBedankt"));
const MijnZpPolis = lazy(() => import("./pages/mijn-zp/Certificaat"));
const MijnZpPauzeren = lazy(() => import("./pages/mijn-zp/Pauzeren"));
const MijnZpDocumenten = lazy(() => import("./pages/mijn-zp/Documenten"));
const MijnZpOpzeggen = lazy(() => import("./pages/mijn-zp/Opzeggen"));
const Afmelden = lazy(() => import("./pages/Afmelden"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalInviteAccept = lazy(() => import("./pages/portal/PortalInviteAccept"));
const PortalOverview = lazy(() => import("./pages/portal/PortalOverview"));
const PortalPolicy = lazy(() => import("./pages/portal/PortalPolicy"));
const PortalDocuments = lazy(() => import("./pages/portal/PortalDocuments"));
const PortalInvoices = lazy(() => import("./pages/portal/PortalInvoices"));
const PortalHeractiveer = lazy(() => import("./pages/portal/PortalHeractiveer"));

import { RoleGuard } from "./components/admin/RoleGuard";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";

import { legacyRedirects } from "@/config/legacyRedirects";

/** Alleen deze taalprefixen zijn geldig; al het andere is een 404. */
const SUPPORTED_LANGS = ["en", "de", "fr"];

/**
 * Guard op /:lang — voorkomt dat een willekeurig eerste pad-segment de
 * homepage rendert (onbeperkte duplicate content).
 */
const LangGuard = () => {
  const { lang } = useParams();
  if (!lang || !SUPPORTED_LANGS.includes(lang)) {
    return <NotFound />;
  }
  return <Outlet />;
};

const queryClient = new QueryClient();


const publicRoutes = (
  <>
    <Route index element={<Index />} />
    <Route path="diensten" element={<Diensten />} />
    <Route path="verzekeringen" element={<Verzekeringen />} />
    <Route path="bav-zzp-vergelijken" element={<BavZzpVergelijken />} />
    <Route path="aov" element={<AOV />} />
    <Route path="pensioen" element={<Pensioen />} />
    <Route path="zorgverzekering" element={<Zorgverzekering />} />
    <Route path="zzp-verzekering-ict" element={<ZzpVerzekeringICT />} />
    <Route path="zzp-verzekering-zorg" element={<ZzpVerzekeringZorg />} />
    <Route path="zzp-verzekering-bouw" element={<ZzpVerzekeringBouw />} />
    <Route path="zzp-verzekering-consultant" element={<ZzpVerzekeringConsultant />} />
    <Route path="zzp-verzekering-interim-manager" element={<ZzpVerzekeringInterimManager />} />
    <Route path="zzp-verzekering-finance" element={<ZzpVerzekeringFinance />} />
    <Route path="zzp-verzekering-hr" element={<ZzpVerzekeringHR />} />
    <Route path="starters" element={<Starters />} />
    <Route path="zzp-verzekering-marketing" element={<ZzpVerzekeringMarketing />} />
    <Route path="zzp-verzekering-coach" element={<ZzpVerzekeringCoach />} />
    <Route path="mentale-gezondheid" element={<MentaleGezondheid />} />
    <Route path="waarom-zp-zaken" element={<WaaromZpZaken />} />
    <Route path="voor-wie" element={<VoorWie />} />
    <Route path="zo-werken-wij" element={<ZoWerkenWij />} />
    <Route path="kennisbank" element={<Kennisbank />} />
    <Route path="kennisbank/wet-en-regelgeving" element={<KennisbankWetEnRegelgeving />} />
    <Route path="kennisbank/ondernemen" element={<KennisbankOndernemen />} />
    <Route path="kennisbank/belastingen" element={<KennisbankBelastingen />} />
    <Route path="kennisbank/financien" element={<KennisbankFinancien />} />
    <Route path="kennisbank/verzekeringen" element={<KennisbankVerzekeringen />} />
    <Route path="kennisbank/:slug" element={<ArtikelDetail />} />
    <Route path="over-ons" element={<OverOns />} />
    <Route path="partners" element={<Partners />} />
    <Route path="historie" element={<Historie />} />
    <Route path="contact" element={<Contact />} />
    <Route path="cookies" element={<Cookies />} />
    <Route path="faq" element={<FAQ />} />
    <Route path="algemene-voorwaarden" element={<AlgemeneVoorwaarden />} />
    <Route path="klachtenprocedure" element={<Klachtenprocedure />} />
    <Route path="klachten" element={<Navigate to="/klachtenprocedure" replace />} />
    <Route path="documenten" element={<Documenten />} />
    <Route path="documenten/slotverklaring" element={<SlotverklaringPage />} />
    <Route path="documenten/dienstverleningsdocument" element={<DienstverleningsdocumentPage />} />
    <Route path="documenten/gedragscode" element={<GedragscodePage />} />
    <Route path="collectieve-inkoop" element={<CollectieveInkoop />} />
    {/* TODO: Re-enable collectief-ledenorganisaties route when ready to go live */}
    {/* <Route path="collectief-ledenorganisaties" element={<CollectiefLedenorganisaties />} /> */}
    <Route path="social-media" element={<SocialMedia />} />
    <Route path="creditcontrol" element={<CreditControl />} />
    <Route path="screening" element={<Screening />} />
    <Route path="offerte" element={<OffertePage />} />
    <Route path="offerte/bedankt" element={<OfferteBedankt />} />
    <Route path="mijn-zp/polis" element={<MijnZpPolis />} />
    <Route path="mijn-zp/certificaat" element={<Navigate to="/mijn-zp/polis" replace />} />
    <Route path="mijn-zp/pauzeren" element={<MijnZpPauzeren />} />
    <Route path="mijn-zp/documenten" element={<MijnZpDocumenten />} />
    <Route path="mijn-zp/opzeggen" element={<MijnZpOpzeggen />} />
    <Route path="afmelden" element={<Afmelden />} />
  </>
);

/** Alle routes; gedeeld door de browser (App) en de prerender (entry-server). */
export const AppRoutes = () => (
          <Suspense fallback={<div aria-busy="true" style={{ minHeight: "100vh" }} />}>
          <Routes>
            {/* Default (NL) routes */}
            <Route path="/">{publicRoutes}</Route>

            {/* WordPress legacy redirects — MUST come before /:lang */}
            {legacyRedirects.map(({ from, to }) => (
              <Route key={from} path={`/${from}`} element={<Navigate to={to} replace />} />
            ))}
            
            {/* Language-prefixed routes */}
            <Route path="/:lang" element={<LangGuard />}>{publicRoutes}</Route>

            {/* Admin routes (no i18n) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/wachtwoord-vergeten" element={<ForgotPassword />} />
            <Route path="/admin/wachtwoord-reset" element={<ResetPassword />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin/wachtwoord-wijzigen" element={<ChangePasswordPage />} />
            <Route element={<AdminAalGuard />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/crm" element={<AdminCRM />} />
            <Route path="/admin/activiteiten" element={<RoleGuard allow={[]}><AdminActiviteiten /></RoleGuard>} />
            <Route path="/admin/leads" element={<AdminLeads soort="leads" />} />
            <Route path="/admin/aanvragen" element={<AdminLeads soort="aanvragen" />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/admin/team" element={<RoleGuard allow={["admin"]}><AdminTeam /></RoleGuard>} />
            <Route path="/admin/dba-checks" element={<AdminDbaChecks />} />
            <Route path="/admin/dba-checks/nieuw" element={<DbaCheckNew />} />
            <Route path="/admin/dba-checks/bulk" element={<DbaCheckBulk />} />
            <Route path="/admin/dba-checks/bulk/:id" element={<DbaCheckBatchDetail />} />
            <Route path="/admin/dba-checks/:id" element={<DbaCheckDetail />} />
            <Route path="/admin/screening-aanvragen" element={<AdminScreeningAanvragen />} />
            <Route path="/admin/screening-aanvragen/:id" element={<AdminScreeningAanvraagDetail />} />
            <Route path="/admin/service-aanvragen" element={<AdminServiceAanvragen />} />
            <Route path="/admin/opzeggingen" element={<AdminServiceAanvragen modus="opzeggingen" />} />
            <Route path="/admin/portaltoegang" element={<AdminServiceAanvragen modus="portaltoegang" />} />
            <Route path="/admin/bav-nummer-nakijken" element={<AdminBavNummerNakijken />} />
            <Route path="/admin/service-aanvragen/:id" element={<AdminServiceAanvraagDetail />} />
            <Route path="/admin/social-media" element={<RoleGuard allow={["marketing"]}><AdminSocialMediaFeatures /></RoleGuard>} />
            <Route path="/admin/marketing" element={<RoleGuard allow={["marketing"]}><AdminMarketing /></RoleGuard>} />
            <Route path="/admin/kennisbank" element={<RoleGuard allow={["marketing"]}><AdminKennisbank /></RoleGuard>} />
            <Route path="/admin/kennisbank/actualiteit" element={<RoleGuard allow={["marketing"]}><AdminKennisbankActualiteit /></RoleGuard>} />
            <Route path="/admin/kennisbank/nieuw" element={<RoleGuard allow={["marketing"]}><AdminKennisbankEditor /></RoleGuard>} />
            <Route path="/admin/kennisbank/:id" element={<RoleGuard allow={["marketing"]}><AdminKennisbankEditor /></RoleGuard>} />
            <Route path="/admin/afgehaakt" element={<RoleGuard allow={["verzekering"]}><AdminAfgehaakt /></RoleGuard>} />
            <Route path="/admin/klanten" element={<RoleGuard allow={["verzekering"]}><AdminKlantenContracten /></RoleGuard>} />
            <Route path="/admin/klanten/:id" element={<RoleGuard allow={["verzekering"]}><AdminKlantDetail /></RoleGuard>} />
            <Route path="/admin/personen/:id" element={<RoleGuard allow={["verzekering"]}><AdminPersoonDetail /></RoleGuard>} />
            <Route path="/admin/facturatieplanning" element={<RoleGuard allow={[]}><AdminFacturatieplanning /></RoleGuard>} />
            <Route path="/admin/exact-reconciliatie" element={<RoleGuard allow={[]}><AdminExactReconciliatie /></RoleGuard>} />
            <Route path="/admin/chatgesprekken" element={<AdminChatgesprekken />} />
            <Route path="/admin/niet-gevonden" element={<RoleGuard allow={["marketing"]}><AdminNietGevonden /></RoleGuard>} />
            <Route path="/admin/wp-import" element={<RoleGuard allow={["admin"]}><AdminWpImport /></RoleGuard>} />

            <Route path="/admin/integraties" element={<RoleGuard allow={["admin"]}><AdminIntegraties /></RoleGuard>} />
            <Route path="/admin/exact-koppeling" element={<RoleGuard allow={["admin"]}><AdminExactKoppeling /></RoleGuard>} />
            <Route path="/admin/interne-meldingen" element={<RoleGuard allow={["admin"]}><AdminInterneMeldingen /></RoleGuard>} />
            <Route path="/admin/activiteitenlog" element={<RoleGuard allow={["admin"]}><AdminActiviteitenlog /></RoleGuard>} />
            </Route>
            <Route path="/api/exact/callback" element={<ExactCallback />} />

            
            {/* Public verification */}
            <Route path="/verificatie/dba/:token" element={<DbaVerificatie />} />
            <Route path="/screenshot-helper" element={<ScreenshotHelper />} />

            {/* Klantportaal */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/invite/:token" element={<PortalInviteAccept />} />
            <Route path="/portal" element={<RequirePortalAuth><PortalOverview /></RequirePortalAuth>} />
            <Route path="/portal/polis" element={<RequirePortalAuth><PortalPolicy /></RequirePortalAuth>} />
            <Route path="/portal/documenten" element={<RequirePortalAuth><PortalDocuments /></RequirePortalAuth>} />
            <Route path="/portal/facturen" element={<RequirePortalAuth><PortalInvoices /></RequirePortalAuth>} />
            <Route path="/portal/heractiveer/:leadId" element={<RequirePortalAuth><PortalHeractiveer /></RequirePortalAuth>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
);

/** Providers zonder router; de router verschilt tussen browser en prerender. */
export const AppProviders = ({ client, children }: { client: QueryClient; children: React.ReactNode }) => (
  <QueryClientProvider client={client}>
    <AuthProvider>
      <PortalAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
      </PortalAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

/** Houdt de GA-opt-out-vlag synchroon met de route (geen GA4 op admin/portal/mijn-zp). */
function GaRouteGuard() {
  const { pathname } = useLocation();
  useEffect(() => { zetGaUitschakeling(pathname); }, [pathname]);
  return null;
}

const App = () => (
  <AppProviders client={queryClient}>
    <BrowserRouter>
      <GaRouteGuard />
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  </AppProviders>
);

export default App;
