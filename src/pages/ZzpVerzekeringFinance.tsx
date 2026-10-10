import { Calculator, Clock, ShieldCheck } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Is deze polis geschikt voor een interim controller?", answer: "Ja. Werk je als interim controller, financial controller of business controller, dan kun je deze polis afsluiten." },
  { question: "Ik ben accountant met wettelijke taken. Kan ik deze polis afsluiten?", answer: "Neem eerst contact op. Voor accountants met wettelijke taken gelden aparte eisen. We kijken samen wat past." },
  { question: "Geldt dit ook voor Wft-adviseurs?", answer: "Nee, niet zonder overleg. Voor financieel advies onder de Wft gelden aparte eisen. Neem contact met ons op." },
  { question: "Wat kost een BAV voor een interim CFO?", answer: `De BAV en AVB samen kosten vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar, zonder eigen risico.` },
  { question: "Wat is gedekt bij een fout in een rapportage?", answer: "Dat hangt af van de situatie. Wat precies gedekt is, staat in de polisvoorwaarden. Die zijn leidend. Je vindt ze op de pagina documenten." },
];

export default function ZzpVerzekeringFinance() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-finance"
      serviceName="Beroepsaansprakelijkheidsverzekering finance"
      badge="Voor finance professionals"
      title={<>ZZP verzekering voor <span className="text-accent">finance professionals</span></>}
      subtitle="Als interim controller of CFO werk je met cijfers waar je opdrachtgever op stuurt. Een fout in een rapportage of prognose kan grote gevolgen hebben. Met een BAV en AVB in één polis ben je beschermd."
      sector="management-consultancy"
      benefits={[
        { icon: Calculator, title: "Voor controllers en interim CFO's", description: `Voor financial controllers, business controllers en interim CFO's. Je bent verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Je betaalt geen eigen risico bij een schade. De polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Online en binnen 24 uur", description: "Je vraagt online aan. Binnen 24 uur geregeld, met je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Cijfers waar je opdrachtgever op vertrouwt", text: "Je maakt rapportages, begrotingen en prognoses. Een fout in je cijfers kan leiden tot een verkeerde keuze van je opdrachtgever. Een BAV beschermt je als je daarvoor aansprakelijk wordt gesteld. Wat precies gedekt is, staat in de polisvoorwaarden.", bullets: ["BAV en AVB in één polis via Hiscox", "Persoonlijk contact over je opdracht", "Certificaat dat je binnen 24 uur kunt doorsturen"] },
        { title: "Accountant met wettelijke taken of Wft-adviseur?", text: "Ben je accountant met wettelijke taken, zoals een controle van de jaarrekening? Of geef je financieel advies onder de Wft? Neem dan eerst contact met ons op. Daarvoor gelden aparte eisen." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
    />
  );
}
