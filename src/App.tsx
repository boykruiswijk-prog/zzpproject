import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Diensten from "./pages/Diensten";
import Verzekeringen from "./pages/Verzekeringen";
import AOV from "./pages/AOV";
import Pensioen from "./pages/Pensioen";
import Zorgverzekering from "./pages/Zorgverzekering";
import MentaleGezondheid from "./pages/MentaleGezondheid";
import WaaromZpZaken from "./pages/WaaromZpZaken";
import VoorWie from "./pages/VoorWie";
import ZoWerkenWij from "./pages/ZoWerkenWij";
import Kennis from "./pages/Kennis";
import Kennisbank from "./pages/Kennisbank";
import KennisbankWetEnRegelgeving from "./pages/kennisbank/WetEnRegelgeving";
import KennisbankOndernemen from "./pages/kennisbank/Ondernemen";
import KennisbankBelastingen from "./pages/kennisbank/Belastingen";
import KennisbankFinancien from "./pages/kennisbank/Financien";
import ArtikelDetail from "./pages/ArtikelDetail";
import OverOns from "./pages/OverOns";
import Partners from "./pages/Partners";
import Historie from "./pages/Historie";
import Contact from "./pages/Contact";
import Cookies from "./pages/Cookies";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import CollectieveInkoop from "./pages/CollectieveInkoop";
import CollectiefLedenorganisaties from "./pages/CollectiefLedenorganisaties";
import SocialMedia from "./pages/SocialMedia";
import CreditControl from "./pages/CreditControl";
import Screening from "./pages/Screening";
import AdminScreeningAanvragen from "./pages/admin/ScreeningAanvragen";
import AdminScreeningAanvraagDetail from "./pages/admin/ScreeningAanvraagDetailPage";
import AdminServiceAanvragen from "./pages/admin/ServiceAanvragen";
import AdminServiceAanvraagDetail from "./pages/admin/ServiceAanvraagDetailPage";
import AdminCRM from "./pages/admin/CRM";
import AdminActiviteiten from "./pages/admin/Activiteiten";
import AdminSocialMediaFeatures from "./pages/admin/SocialMediaFeatures";
import AdminIntegraties from "./pages/admin/Integraties";
import AdminExactKoppeling from "./pages/admin/ExactKoppeling";
import AdminMarketing from "./pages/admin/MarketingPlaceholder";
import { RoleGuard } from "./components/admin/RoleGuard";
import ExactCallback from "./pages/ExactCallback";
import AdminLogin from "./pages/admin/LoginPage";
import ChangePasswordPage from "./pages/admin/ChangePasswordPage";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLeads from "./pages/admin/Leads";
import AdminLeadDetail from "./pages/admin/LeadDetail";
import AdminTeam from "./pages/admin/Team";
import AdminDbaChecks from "./pages/admin/DbaChecks";
import DbaCheckNew from "./pages/admin/DbaCheckNew";
import DbaCheckDetail from "./pages/admin/DbaCheckDetail";
import DbaCheckBulk from "./pages/admin/DbaCheckBulk";
import DbaCheckBatchDetail from "./pages/admin/DbaCheckBatchDetail";
import DbaVerificatie from "./pages/DbaVerificatie";
import ForgotPassword from "./pages/admin/ForgotPasswordPage";
import ResetPassword from "./pages/admin/ResetPasswordPage";
import ScreenshotHelper from "./pages/ScreenshotHelper";
import AlgemeneVoorwaarden from "./pages/AlgemeneVoorwaarden";
import Klachtenprocedure from "./pages/Klachtenprocedure";
import Documenten from "./pages/Documenten";
import SlotverklaringPage from "./pages/documenten/SlotverklaringPage";
import DienstverleningsdocumentPage from "./pages/documenten/DienstverleningsdocumentPage";
import GedragscodePage from "./pages/documenten/GedragscodePage";
import OffertePage from "./pages/OffertePage";
import OfferteBedankt from "./pages/OfferteBedankt";
import MijnZpPolis from "./pages/mijn-zp/Certificaat";
import MijnZpPauzeren from "./pages/mijn-zp/Pauzeren";
import MijnZpDocumenten from "./pages/mijn-zp/Documenten";
import MijnZpOpzeggen from "./pages/mijn-zp/Opzeggen";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalInviteAccept from "./pages/portal/PortalInviteAccept";
import PortalOverview from "./pages/portal/PortalOverview";
import PortalPolicy from "./pages/portal/PortalPolicy";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalHeractiveer from "./pages/portal/PortalHeractiveer";

/** Old WordPress URLs indexed by Google → redirect to new routes */
const wpRedirects: Array<[string, string]> = [
  ["belastingen", "/kennisbank"],
  ["ondernemen", "/kennisbank"],
  ["financien", "/kennisbank"],
  ["verzekeringen-info", "/kennisbank"],
  ["movir", "/verzekeringen"],
  ["wijzijnaov", "/verzekeringen"],
  ["aov-via-centraalbeheer", "/verzekeringen"],
  ["sharepeople", "/partners"],
  ["eherkenning", "/kennisbank"],
  ["verplichte-aov-voor-zzp", "/kennisbank/aov-arbeidsongeschiktheidsverzekering"],
  ["nieuwe-regels-zzp", "/kennisbank/nieuwe-regels-zzp-2025"],
  ["hoeveel-opdrachtgevers-zzp", "/kennisbank"],
  ["alles-over-een-zzp-factuur", "/kennisbank"],
  ["inschrijven-bij-de-kamer-van-koophandel", "/kennisbank"],
  ["zzp-administratie-en-boekhouding", "/diensten"],
  ["hoe-bereken-ik-bijtelling-als-zzper", "/kennisbank"],
  ["is-eten-en-drinken-aftrekbaar-als-zzp-er", "/kennisbank"],
  ["winkel", "/"],
  ["shop", "/"],
  ["product", "/"],
  ["mijn-account", "/"],
  ["my-account", "/"],
  // Extra redirects van bestaande zpzaken.nl naar nieuwe routes
  ["beroeps-en-bedrijfsaansprakelijkheidsverzekering-zzp-avb-bav", "/kennisbank/zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb"],
  ["bijdrage-zorgverzekeringswet-zzp", "/zorgverzekering"],
  ["hoe-zit-het-met-reiskosten-als-zzp-er", "/kennisbank"],
  ["uurtarief-berekenen-zzper", "/kennisbank"],
  ["hoeveel-kan-je-als-zzp-er-verdienen-zonder-belasting-te-moeten-betalen", "/kennisbank"],
  ["zpzakenaov-movir", "/aov"],
  ["arbeidsongeschiktheidsverzekering-aov-zzp", "/aov"],
  ["alles-over-verzekeringen-voor-zzpers", "/verzekeringen"],
  ["een-aov-bij-movir-aanvragen", "/aov"],
  ["contact-zpzaken", "/contact"],
  ["neem-gerust-contact-op", "/contact"],
  // Gangbare WordPress URL patronen
  ["bav-verzekering", "/verzekeringen"],
  ["avb-verzekering", "/verzekeringen"],
  ["bav-avb", "/verzekeringen"],
  ["zzp-verzekering", "/verzekeringen"],
  ["zzp-verzekeringen", "/verzekeringen"],
  ["verzekering-zzp", "/verzekeringen"],
  ["aov-zzp", "/aov"],
  ["zzp-aov", "/aov"],
  ["pensioen-zzp", "/pensioen"],
  ["zzp-pensioen", "/pensioen"],
  ["zorgverzekering-zzp", "/zorgverzekering"],
  ["gratis-advies", "/contact"],
  ["adviesgesprek", "/contact"],
  ["offerte", "/contact"],
  ["aanvragen", "/verzekeringen"],
  ["afsluiten", "/verzekeringen"],
  ["blog", "/kennisbank"],
  ["nieuws", "/kennisbank"],
  ["artikel", "/kennisbank"],
  ["over", "/over-ons"],
  ["team", "/over-ons"],
  ["wie-zijn-wij", "/over-ons"],
  ["privacy", "/cookies"],
  ["privacyverklaring", "/cookies"],
  ["voorwaarden", "/algemene-voorwaarden"],
  ["disclaimer", "/faq"],
];

const queryClient = new QueryClient();

const publicRoutes = (
  <>
    <Route index element={<Index />} />
    <Route path="diensten" element={<Diensten />} />
    <Route path="verzekeringen" element={<Verzekeringen />} />
    <Route path="aov" element={<AOV />} />
    <Route path="pensioen" element={<Pensioen />} />
    <Route path="zorgverzekering" element={<Zorgverzekering />} />
    <Route path="mentale-gezondheid" element={<MentaleGezondheid />} />
    <Route path="waarom-zp-zaken" element={<WaaromZpZaken />} />
    <Route path="voor-wie" element={<VoorWie />} />
    <Route path="zo-werken-wij" element={<ZoWerkenWij />} />
    <Route path="kennis" element={<Kennis />} />
    <Route path="kennisbank" element={<Kennisbank />} />
    <Route path="kennisbank/wet-en-regelgeving" element={<KennisbankWetEnRegelgeving />} />
    <Route path="kennisbank/ondernemen" element={<KennisbankOndernemen />} />
    <Route path="kennisbank/belastingen" element={<KennisbankBelastingen />} />
    <Route path="kennisbank/financien" element={<KennisbankFinancien />} />
    <Route path="kennisbank/:slug" element={<ArtikelDetail />} />
    <Route path="over-ons" element={<OverOns />} />
    <Route path="partners" element={<Partners />} />
    <Route path="historie" element={<Historie />} />
    <Route path="contact" element={<Contact />} />
    <Route path="cookies" element={<Cookies />} />
    <Route path="faq" element={<FAQ />} />
    <Route path="algemene-voorwaarden" element={<AlgemeneVoorwaarden />} />
    <Route path="klachtenprocedure" element={<Klachtenprocedure />} />
    <Route path="klachten" element={<Klachtenprocedure />} />
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
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PortalAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Default (NL) routes */}
            <Route path="/">{publicRoutes}</Route>

            {/* WordPress legacy redirects — MUST come before /:lang */}
            {wpRedirects.map(([from, to]) => (
              <Route key={from} path={`/${from}`} element={<Navigate to={to} replace />} />
            ))}
            
            {/* Language-prefixed routes */}
            <Route path="/:lang">{publicRoutes}</Route>

            {/* Admin routes (no i18n) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/wachtwoord-vergeten" element={<ForgotPassword />} />
            <Route path="/admin/wachtwoord-reset" element={<ResetPassword />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin/wachtwoord-wijzigen" element={<ChangePasswordPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/crm" element={<AdminCRM />} />
            <Route path="/admin/activiteiten" element={<AdminActiviteiten />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            <Route path="/admin/dba-checks" element={<AdminDbaChecks />} />
            <Route path="/admin/dba-checks/nieuw" element={<DbaCheckNew />} />
            <Route path="/admin/dba-checks/bulk" element={<DbaCheckBulk />} />
            <Route path="/admin/dba-checks/bulk/:id" element={<DbaCheckBatchDetail />} />
            <Route path="/admin/dba-checks/:id" element={<DbaCheckDetail />} />
            <Route path="/admin/screening-aanvragen" element={<AdminScreeningAanvragen />} />
            <Route path="/admin/screening-aanvragen/:id" element={<AdminScreeningAanvraagDetail />} />
            <Route path="/admin/service-aanvragen" element={<AdminServiceAanvragen />} />
            <Route path="/admin/service-aanvragen/:id" element={<AdminServiceAanvraagDetail />} />
            <Route path="/admin/social-media" element={<AdminSocialMediaFeatures />} />
            <Route path="/admin/integraties" element={<AdminIntegraties />} />
            <Route path="/admin/exact-koppeling" element={<AdminExactKoppeling />} />
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
        </BrowserRouter>
      </TooltipProvider>
      </PortalAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
