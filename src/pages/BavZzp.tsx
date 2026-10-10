import { Clock, ShieldCheck, CalendarCheck } from "lucide-react";
import { BeroepVerzekeringPagina, PRIJS_MAAND, PRIJS_JAAR } from "@/components/diensten/BeroepVerzekeringPagina";
import { LandingVerzekeringBlokken, BAV_MILJOEN, AVB_MILJOEN } from "@/components/diensten/LandingVerzekeringBlokken";

const faqs = [
  { question: "Wat dekt een BAV?", answer: "Een BAV dekt schade die je opdrachtgever lijdt door een fout in je werk als zzp'er. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat is het verschil tussen BAV en AVB?", answer: "De BAV gaat over financiële schade door fouten in je werk, zoals een verkeerde berekening. De AVB gaat over schade aan personen of aan spullen van anderen. Bij ZP Zaken zitten ze samen in één polis. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat kost een BAV voor zzp'ers?", answer: `Vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar voor BAV en AVB samen, inclusief kosten en assurantiebelasting. Je betaalt geen eigen risico.` },
  { question: "Is een BAV verplicht?", answer: "Nee, een BAV is niet wettelijk verplicht. Opdrachtgevers eisen het wel vaak in hun contract." },
  { question: "Hoe snel heb ik een certificaat?", answer: "Binnen 24 uur geregeld. Je krijgt het certificaat per mail voor je opdrachtgever." },
  { question: "Kan ik dagelijks opzeggen en is er uitloopdekking?", answer: "Je polis is dagelijks opzegbaar, zonder jaarcontract. Deze polis heeft geen uitloopdekking: na het einde van je polis vallen nieuwe aanspraken er niet meer onder." },
];

export default function BavZzp() {
  return (
    <BeroepVerzekeringPagina
      path="/bav-zzp"
      serviceName="BAV en AVB voor zzp'ers"
      badge="BAV + AVB"
      title={<>BAV voor zzp'ers: <span className="text-accent">beroeps- en bedrijfsaansprakelijkheid in één polis</span></>}
      subtitle={`Een BAV beschermt je bij schade door fouten in je werk, de AVB bij schade aan personen of spullen. Bij ZP Zaken heb je ze samen vanaf ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting.`}
      sector=""
      benefits={[
        { icon: ShieldCheck, title: "Eén polis via Hiscox", description: `${BAV_MILJOEN} BAV en ${AVB_MILJOEN} AVB per aanspraak, zonder eigen risico.` },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Online aanvragen, certificaat per mail voor je opdrachtgever." },
        { icon: CalendarCheck, title: "Geen jaarcontract", description: "Dagelijks opzegbaar en een ingangsdatum die je zelf kiest." },
      ]}
      explainers={[
        { title: "Persoonlijke service", text: "Vragen over de aanvraag of de polisvoorwaarden? We beantwoorden ze graag. Bel ons op 020 - 457 3077." },
      ]}
      faqs={faqs}
      leesMeer={["wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
      extra={<LandingVerzekeringBlokken />}
    />
  );
}
