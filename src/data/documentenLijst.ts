export type DocumentType = 'brochure' | 'polisvoorwaarden' | 'verzekeringskaart' | 'eigen' | 'aanvullend';

export interface Document {
  id: string;
  titel: string;
  type: DocumentType;
  path: string;
  productCode?: string;
  isHtmlPage?: boolean;
}

export interface DocumentBranche {
  id: string;
  naam: string;
  subnaam?: string;
  documenten: Document[];
}

export const branches: DocumentBranche[] = [
  {
    id: 'ict',
    naam: 'ICT',
    subnaam: 'IT & ICT',
    documenten: [
      { id: 'brochure-ict', titel: 'Brochure beroepsaansprakelijkheid', type: 'brochure', path: '/documenten/Brochure-beroepsaansprakelijkheid.pdf' },
      { id: 'polis-ict', titel: 'Polisvoorwaarden beroepsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Polisvoorwaarden-beroepsaansprakelijkheid-TPH-2020.pdf', productCode: 'TPH-2020' },
      { id: 'kaart-ict', titel: 'Verzekeringskaart beroepsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Verzekeringskaart-beroepsaansprakelijkheid-TPH-2020.pdf', productCode: 'TPH-2020' },
      { id: 'voorwaarden-kantoorrisico-ict', titel: 'Aanvullende voorwaarden kantoorrisico', type: 'aanvullend', path: '/documenten/Beroepsaansprakelijkheid_voorwaarden_kantoorrisico.pdf' },
    ],
  },
  {
    id: 'management-consultancy',
    naam: 'Management consultancy',
    subnaam: 'HR & Finance consultancy',
    documenten: [
      { id: 'brochure-mc', titel: 'Brochure beroepsaansprakelijkheid', type: 'brochure', path: '/documenten/Brochure-beroepsaansprakelijkheid-1.pdf' },
      { id: 'polis-mc', titel: 'Polisvoorwaarden beroepsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Polisvoorwaarden-beroepsaansprakelijkheid-MCPH-2013B.pdf', productCode: 'MCPH-2013B' },
      { id: 'kaart-mc', titel: 'Verzekeringskaart beroepsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Verzekeringskaart-beroepsaansprakelijkheid-MCPH-2013B.pdf', productCode: 'MCPH-2013B' },
    ],
  },
  {
    id: 'pr-marketing',
    naam: 'Reclame- & marketingbureaus',
    subnaam: 'PR & Marketing',
    documenten: [
      { id: 'brochure-pm', titel: 'Brochure beroepsaansprakelijkheid', type: 'brochure', path: '/documenten/Brochure-beroepsaansprakelijkheid-2.pdf' },
      { id: 'polis-pm', titel: 'Polisvoorwaarden beroepsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Polisvoorwaarden-beroepsaansprakelijkheid-MAPM-08B-1.pdf', productCode: 'MAPM-08B' },
      { id: 'kaart-pm', titel: 'Verzekeringskaart beroepsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Verzekeringskaart-beroepsaansprakelijkheid-MAPM-08B.pdf', productCode: 'MAPM-08B' },
    ],
  },
  {
    id: 'coaches',
    naam: 'Coaches',
    documenten: [
      { id: 'brochure-co', titel: 'Brochure beroepsaansprakelijkheid', type: 'brochure', path: '/documenten/Coaches-Brochure-beroepsaansprakelijkheid.pdf' },
      { id: 'polis-co', titel: 'Polisvoorwaarden beroepsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Coaches-Polisvoorwaarden-beroepsaansprakelijkheid-MCPH-2013B.pdf', productCode: 'MCPH-2013B' },
      { id: 'kaart-co', titel: 'Verzekeringskaart beroepsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Coaches-Verzekeringskaart-beroepsaansprakelijkheid-MCPH-2013B.pdf', productCode: 'MCPH-2013B' },
    ],
  },
  {
    id: 'zakelijke-dienstverlening',
    naam: 'Zakelijke dienstverlening',
    subnaam: 'Niet-uitvoerende beroepen',
    documenten: [
      { id: 'brochure-zd', titel: 'Brochure beroepsaansprakelijkheid', type: 'brochure', path: '/documenten/Brochure-beroepsaansprakelijkheid.pdf' },
      { id: 'polis-zd', titel: 'Polisvoorwaarden beroepsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Overige-zakelijke-dienstverlening-Polisvoorwaarden-beroepsaansprakelijkheid-MPH-2013B.pdf', productCode: 'MPH-2013B' },
      { id: 'kaart-zd', titel: 'Verzekeringskaart beroepsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Overige-zakelijke-dienstverlening-Verzekeringskaart-beroepsaansprakelijkheid-MPH-2013B.pdf', productCode: 'MPH-2013B' },
    ],
  },
];

export const algemeneBavDocumenten: Document[] = [
  { id: 'polis-bav', titel: 'Polisvoorwaarden bedrijfsaansprakelijkheid', type: 'polisvoorwaarden', path: '/documenten/Verzekeringskaart-bedrijfsaansprakelijkheid-HAVB-08B.pdf', productCode: 'HAVB-08B' },
  { id: 'kaart-bav', titel: 'Verzekeringskaart bedrijfsaansprakelijkheid', type: 'verzekeringskaart', path: '/documenten/Verzekeringskaart-bedrijfsaansprakelijkheid-HAVB-08B.pdf', productCode: 'HAVB-08B' },
];

export const aanvullendeDocumenten: Document[] = [];

export const zpZakenEigenDocumenten: Document[] = [
  { id: 'slotverklaring', titel: 'Slotverklaring 2026', type: 'eigen', path: '/documenten/slotverklaring', isHtmlPage: true },
  { id: 'dvd', titel: 'Dienstverleningsdocument', type: 'eigen', path: '/documenten/dienstverleningsdocument', isHtmlPage: true },
  { id: 'gedragscode', titel: 'Gedragscode', type: 'eigen', path: '/documenten/gedragscode', isHtmlPage: true },
];
