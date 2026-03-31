import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

import Index from "./Index";
import Diensten from "./Diensten";
import Verzekeringen from "./Verzekeringen";
import AOV from "./AOV";
import Pensioen from "./Pensioen";
import Zorgverzekering from "./Zorgverzekering";
import MentaleGezondheid from "./MentaleGezondheid";
import WaaromZpZaken from "./WaaromZpZaken";
import VoorWie from "./VoorWie";
import ZoWerkenWij from "./ZoWerkenWij";
import Kennis from "./Kennis";
import Kennisbank from "./Kennisbank";
import OverOns from "./OverOns";
import Partners from "./Partners";
import Historie from "./Historie";
import Contact from "./Contact";
import FAQ from "./FAQ";
import CollectieveInkoop from "./CollectieveInkoop";

const pages = [
  { name: "Homepage", Component: Index },
  { name: "Diensten", Component: Diensten },
  { name: "Verzekeringen (BAV/AVB)", Component: Verzekeringen },
  { name: "AOV", Component: AOV },
  { name: "Pensioen", Component: Pensioen },
  { name: "Zorgverzekering", Component: Zorgverzekering },
  { name: "Mentale Gezondheid", Component: MentaleGezondheid },
  { name: "Waarom ZP Zaken", Component: WaaromZpZaken },
  { name: "Voor Wie", Component: VoorWie },
  { name: "Zo Werken Wij", Component: ZoWerkenWij },
  { name: "Kennis", Component: Kennis },
  { name: "Kennisbank", Component: Kennisbank },
  { name: "Over Ons", Component: OverOns },
  { name: "Partners", Component: Partners },
  { name: "Historie", Component: Historie },
  { name: "Contact", Component: Contact },
  { name: "FAQ", Component: FAQ },
  { name: "Collectieve Inkoop", Component: CollectieveInkoop },
];

export default function ScreenshotHelper() {
  return (
    <>
      <style>{`
        @media print {
          .screenshot-no-print { display: none !important; }
          .screenshot-page-block { 
            page-break-before: always; 
            break-before: page;
          }
          .screenshot-page-block:first-of-type {
            page-break-before: avoid;
            break-before: avoid;
          }
        }
      `}</style>

      <div className="screenshot-no-print sticky top-0 z-50 bg-background border-b p-4 flex items-center gap-4">
        <Button onClick={() => window.print()} variant="default" size="lg">
          <Printer className="mr-2 h-5 w-5" />
          Print / Save as PDF
        </Button>
        <span className="text-sm text-muted-foreground">
          {pages.length} pagina's — scroll om te bekijken
        </span>
      </div>

      {pages.map(({ name, Component }) => (
        <div key={name} className="screenshot-page-block">
          <div className="screenshot-no-print bg-muted border-b px-6 py-3">
            <h2 className="text-lg font-bold text-foreground">{name}</h2>
          </div>
          <div style={{ width: 1440, minHeight: 900, overflow: "hidden" }} className="mx-auto">
            <Component />
          </div>
        </div>
      ))}
    </>
  );
}
