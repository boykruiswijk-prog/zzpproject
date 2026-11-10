import { Clock, ShieldCheck, CalendarCheck } from "lucide-react";
import { BeroepVerzekeringPagina } from "@/components/diensten/BeroepVerzekeringPagina";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { LandingVerzekeringBlokken, BAV_MILJOEN, AVB_MILJOEN } from "@/components/diensten/LandingVerzekeringBlokken";

export const faqs = [
  { question: "Wat is een beroepsaansprakelijkheidsverzekering?", answer: "Een beroepsaansprakelijkheidsverzekering, kortweg BAV, is bedoeld voor claims over financiële schade die je opdrachtgever lijdt door een fout in je werk, zoals een rekenfout, een fout in software of een onjuist rapport. Schade aan personen of spullen valt in de regel onder een bedrijfsaansprakelijkheidsverzekering (AVB). Bij ZP Zaken zitten ze samen in één polis. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat kost een beroepsaansprakelijkheidsverzekering per maand?", answer: "Bij ZP Zaken € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, voor BAV en AVB samen, zonder eigen risico. Met een KVK-inschrijving jonger dan 12 maanden betaal je met het starterspakket de eerste 12 maanden € 45 per maand of € 495 per jaar, daarna € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, onder voorbehoud van controle van je KVK-inschrijvingsdatum.", links: { starterspakket: "/starters" } },
  { question: "Hoeveel verzekerd bedrag heb ik nodig?", answer: "Minimaal het bedrag per aanspraak dat je opdrachtgever in het contract vraagt. Bij ZP Zaken is dat € 5.000.000 per aanspraak voor de BAV en € 2.500.000 per aanspraak voor de AVB. Hoe je de eis in je contract leest, lees je in het artikel Hoeveel dekking heb je nodig met je BAV?" },
  { question: "Wat dekt een beroepsaansprakelijkheidsverzekering niet?", answer: "Je eigen schade valt er niet onder, zoals uren die je onbetaald overdoet of omzet die je misloopt. Schade door opzet en boetes die je zelf krijgt vallen er in de regel ook niet onder. Wat precies gedekt is en wat niet, staat in de polisvoorwaarden." },
  { question: "Wat dekt een beroepsaansprakelijkheidsverzekering?", answer: "Een beroepsaansprakelijkheidsverzekering (BAV) gaat over schade die je opdrachtgever lijdt door een fout in je werk, bijvoorbeeld een rekenfout in een rapport. Wat precies gedekt is en wat niet, staat in de polisvoorwaarden." },
  { question: "Kan ik overstappen van een andere aanbieder?", answer: "Ja. Kies als ingangsdatum de dag nadat je huidige polis eindigt. Fouten van voor die datum zijn bij ZP Zaken niet gedekt, dus vraag je huidige verzekeraar hoe die claims over eerder werk behandelt voordat je opzegt. Binnen 24 uur is het geregeld." },
  { question: "Is een beroepsaansprakelijkheidsverzekering verplicht?", answer: "Voor de meeste zzp'ers niet. Voor advocaten, notarissen, accountants en financieel adviseurs is een BAV wel verplicht, door de wet of door de beroepsorganisatie. Architecten hebben geen wettelijke plicht, maar hun beroepsvereniging kan het eisen. Opdrachtgevers eisen een BAV ook vaak in hun contract. Lees meer in Is een beroepsaansprakelijkheidsverzekering verplicht voor zzp'ers?", links: { "Is een beroepsaansprakelijkheidsverzekering verplicht voor zzp'ers?": "/kennisbank/is-bav-verplicht-zzp" } },
  { question: "Hoe snel heb ik een certificaat?", answer: "Je vraagt online aan. Binnen 24 uur is het geregeld en krijg je het certificaat per mail, zodat je het naar je opdrachtgever kunt sturen." },
  { question: "Kan ik dagelijks opzeggen?", answer: "Ja. De BAV + AVB heeft geen jaarcontract en is dagelijks opzegbaar. Betaal je per jaar, dan krijg je bij opzeggen een creditnota voor de dagen die je al betaald hebt. Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota." },
  { question: "Is er uitloopdekking?", answer: "Nee, deze polis heeft geen uitloopdekking. Na het einde van je polis vallen nieuwe aanspraken niet meer onder deze verzekering." },
];

const faqVolgorde = [0, 4, 3, 1, 5, 6, 2, 7, 8, 9];
export const geordendeFaqs = faqVolgorde.map((i) => faqs[i]);

export default function Beroepsaansprakelijkheidsverzekering() {
  return (
    <BeroepVerzekeringPagina
      waarLetJeOp
      bijgewerkt="10 november 2026"
      naWaarLetJeOp={
        <section className="section-padding bg-background">
          <div className="container-wide max-w-3xl">
            <h2 className="mb-4">Overstappen naar ZP Zaken?</h2>
            <p className="text-muted-foreground">Heb je nu een beroepsaansprakelijkheidsverzekering bij een andere aanbieder? Kies bij je aanvraag als ingangsdatum de dag nadat je huidige polis eindigt, zodat je nieuwe werk zonder onderbreking verzekerd is. Fouten van voor je ingangsdatum zijn bij ZP Zaken niet gedekt. Vraag daarom bij je huidige verzekeraar na hoe die omgaat met claims over werk van voor het opzeggen, voordat je opzegt. Binnen 24 uur is je nieuwe polis geregeld en staat je certificaat in je mailbox.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="accent" asChild><LocalizedLink to="/verzekeringen#combinatiepolis">Online aanvragen</LocalizedLink></Button>
              <Button variant="outline" asChild><LocalizedLink to="/contact">Bel mij terug</LocalizedLink></Button>
            </div>
          </div>
        </section>
      }
      path="/beroepsaansprakelijkheidsverzekering"
      serviceName="Beroepsaansprakelijkheidsverzekering voor zzp'ers"
      badge="Voor zzp'ers"
      title={<>Beroepsaansprakelijkheidsverzekering zzp: <span className="text-accent">wat kost het en hoe regel je het?</span></>}
      subtitle="Een beroepsaansprakelijkheidsverzekering (BAV) is bedoeld voor claims van je opdrachtgever over financiële schade door een fout in je werk. Bij ZP Zaken kost de BAV samen met de AVB € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, zonder eigen risico. BAV € 5.000.000 en AVB € 2.500.000 per aanspraak in één polis, binnen 24 uur geregeld."
      sector=""
      benefits={[
        { icon: ShieldCheck, title: "BAV en AVB in één polis", description: `${BAV_MILJOEN} BAV en ${AVB_MILJOEN} AVB per aanspraak via Hiscox, zonder eigen risico.` },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Je vraagt online aan. Binnen 24 uur staat je certificaat in je mailbox." },
        { icon: CalendarCheck, title: "Dagelijks opzegbaar", description: "Geen jaarcontract. Je kiest zelf de ingangsdatum en zegt dagelijks op." },
      ]}
      explainers={[
        { title: "Persoonlijke service", text: "Vragen over de polis en je opdracht? We beantwoorden je vragen over de aanvraag en de polisvoorwaarden. Bel ons op 020 - 457 3077." },
      ]}
      faqs={geordendeFaqs}
      leesMeer={["wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
      extra={<LandingVerzekeringBlokken />}
    />
  );
}
