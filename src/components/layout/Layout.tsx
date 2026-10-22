import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { StickyContactBar } from "@/components/shared/StickyContactBar";
import { StickyMobileCTA } from "@/components/shared/StickyMobileCTA";
import { ExitIntentPopup } from "@/components/shared/ExitIntentPopup";
import { WhatsAppFloatingButton } from "@/components/common/WhatsAppFloatingButton";
import { ZekerLauncher } from "@/components/zeker/ZekerLauncher";
import { SiteSchemaMarkup } from "@/components/social-proof/SiteSchemaMarkup";
import { TrustSignalsStrip } from "@/components/social-proof/TrustSignalsStrip";
import { TerugbelDialog } from "@/components/shared/TerugbelDialog";

interface LayoutProps {
  children: React.ReactNode;
  /** Alleen voor pagina's waar wij geen gegevens mogen verzamelen (F9 AOV). */
  zonderGegevensPopups?: boolean;
}

export function Layout({ children, zonderGegevensPopups = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteSchemaMarkup />
      <Header />
      <main className="flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      <section className="bg-secondary/40 border-t border-border/40 py-10">
        <div className="container-wide">
          <TrustSignalsStrip />
        </div>
      </section>
      <Footer />
      <CookieConsent />
      {!zonderGegevensPopups && <><StickyMobileCTA /><StickyContactBar /><ExitIntentPopup /></>}
      <WhatsAppFloatingButton />
      <ZekerLauncher />
      {!zonderGegevensPopups && <TerugbelDialog />}
    </div>
  );
}
