import { DocumentPage } from "@/components/documenten/DocumentPage";

export default function SlotverklaringPage() {
  return (
    <DocumentPage
      title="Slotverklaring"
      versie="Versie 2026"
      canonicalSlug="slotverklaring"
      metaDescription="Slotverklaring bij de aanvraag van een beroeps- en bedrijfsaansprakelijkheidsverzekering via ZP Zaken."
    >
      <p>
        Ondergetekende verklaart dat de gegevens zoals verstrekt in de aanvraag voor de
        beroeps- en bedrijfsaansprakelijkheidsverzekering volledig en naar waarheid zijn
        ingevuld.
      </p>
      <p>Daarnaast verklaart ondergetekende dat:</p>
      <ul>
        <li>
          er geen schadegevallen, aanspraken of omstandigheden bekend zijn die kunnen leiden
          tot een claim onder de aan te vragen verzekering;
        </li>
        <li>
          er geen feiten of omstandigheden bekend zijn die van invloed kunnen zijn op de
          beoordeling van het risico;
        </li>
        <li>
          de omschrijving van de werkzaamheden en bedrijfsactiviteiten overeenkomt met de
          daadwerkelijk uitgevoerde werkzaamheden;
        </li>
        <li>
          sinds het invullen van de aanvraag geen relevante wijzigingen hebben plaatsgevonden
          in de bedrijfsactiviteiten of risicosituatie.
        </li>
      </ul>
      <p>
        Ondergetekende begrijpt dat deze verklaring onderdeel uitmaakt van de acceptatie van
        de verzekering en dat onjuiste of onvolledige informatie gevolgen kan hebben voor
        dekking of acceptatie.
      </p>
    </DocumentPage>
  );
}
