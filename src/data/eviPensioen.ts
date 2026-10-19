import { pensioenRegels as r, pensioenEuro as euro } from '../lib/pensioenRekenhulp';
import { fiscaleCijfers as f } from './fiscaleCijfers';
import { EVI_PAGINA_PAD } from '../config/eviPagina';
import { SITE_CONFIG } from '../config/site';
import { ORGANIZATION_ID, breadcrumbSchema, faqSchema } from '../lib/schema';
export const EVI_SEO = {
 path: EVI_PAGINA_PAD,
 title: "Pensioen opbouwen als zzp'er in 2026 | Jaarruimte en lijfrente",
 description: "Pensioen opbouwen als zzp'er: zo werkt de jaarruimte in 2026, wat je fiscaal kunt aftrekken en hoe je via Evi van Lanschot belegt voor later. Met rekenhulp.",
 h1: "Bouw je eigen pensioen op en krijg belasting terug",
 intro: "Als zzp'er bouw je geen pensioen op via een werkgever. Met een lijfrente in de derde pijler regel je dat zelf, en trek je je inleg binnen je jaarruimte af in box 1. ZP Zaken werkt hiervoor samen met Evi van Lanschot."
};
export const EVI_RISICO = "Let op: beleggen brengt risico's met zich mee. Je inleg kan minder waard worden.";
export const EVI_DISCLAIMER = `Deze rekenhulp geeft een indicatie op basis van de fiscale regels van 2026 en is vereenvoudigd. Je exacte jaarruimte en reserveringsruimte bereken je met het hulpmiddel lijfrentepremie van de Belastingdienst. Aan de uitkomst kun je geen rechten ontlenen. ${EVI_RISICO}`;
export const EVI_KORT = `Zzp'ers bouwen pensioen op in de derde pijler: met een lijfrente bij een bank, verzekeraar of beleggingsinstelling. In 2026 mag je ${f.jaarruimtePercentage.waarde}% van je premiegrondslag aftrekken als jaarruimte. De premiegrondslag is je inkomen van 2025 (winst vóór ondernemersaftrek, met een maximum van ${euro(r.maximumInkomen)}) min ${euro(r.franchise)}. Het maximum ligt daarmee rond ${euro(Math.ceil(r.percentage * (r.maximumInkomen-r.franchise)))}. Niet gebruikte ruimte van de afgelopen tien jaar kun je als reserveringsruimte inhalen, in 2026 tot ${euro(r.reserveringMaximum)}. Wat je inlegt, kun je tot je pensioen niet opnemen zonder fiscale gevolgen.`;
export const EVI_PIJLERS = [
 ['AOW', `Iedereen, vanaf de AOW-leeftijd; in 2026 en 2027 is dat ${r.aowLeeftijd} jaar`],
 ['Pensioen via een werkgever', "Heb je als zzp'er meestal niet"],
 ['Eigen opbouw met fiscaal voordeel', 'Lijfrente']
];
export const EVI_DERDE_PIJLER = "Werknemers bouwen naast de AOW pensioen op via hun werkgever. Als zzp'er valt die tweede pijler weg, tenzij je beroep een verplicht pensioenfonds heeft. Wat overblijft is de AOW, en die is voor de meeste mensen niet genoeg om hun levensstijl vast te houden. Het verschil noemen we het pensioengat. De derde pijler is de manier om dat gat zelf te dichten, met steun van de fiscus.";
export const EVI_AOW = `De AOW is per 1 juli 2026 bruto ${euro(r.aowAlleen,2)} per maand voor een alleenstaande en ${euro(r.aowSamen,2)} per persoon als je samenwoont of getrouwd bent, exclusief vakantiegeld. Tel daar het pensioen bij op dat je eventueel nog uit loondienst hebt (te zien op mijnpensioenoverzicht.nl). Wat je overhoudt ten opzichte van het inkomen dat je straks wilt, is je pensioengat. In de rekenhulp hieronder zie je het verschil in één oogopslag.`;
export const EVI_JAARRUIMTE = "De jaarruimte van 2026 rekent met je inkomen over 2025. Voor een ondernemer is dat de winst uit onderneming vóór de zelfstandigenaftrek en andere ondernemersaftrek, plus eventueel loon of ander inkomen. Bouwde je in 2025 ergens pensioen op via een werkgever, dan gaat die opbouw van je jaarruimte af. Sinds de Wet toekomst pensioenen mogen zelfstandigen veel meer aftrekken dan vroeger: het percentage is verhoogd naar 30%. Ook de fiscale oudedagsreserve (FOR) bestaat sinds 2023 niet meer; een bestaande FOR kun je nog wel omzetten in een lijfrente.";
export const EVI_TABEL = [
 ['Percentage jaarruimte', `${f.jaarruimtePercentage.waarde}% van de premiegrondslag`],
 ['Inkomen dat maximaal meetelt', euro(r.maximumInkomen)], ['Franchise (dit deel telt niet mee)', euro(r.franchise)],
 ['Maximale jaarruimte', `rond ${euro(Math.ceil(r.percentage*(r.maximumInkomen-r.franchise)))}`],
 ['Maximale reserveringsruimte (inhalen over 10 jaar)', euro(r.reserveringMaximum)],
 ['Aftrek in box 1, tegen je eigen tarief', [f.schijf1Tarief.waarde,f.schijf2Tarief.waarde,f.schijf3Tarief.waarde].map(n=>`${n.toLocaleString('nl-NL',{minimumFractionDigits:2})}%`).join(' / ')],
 ['AOW-leeftijd 2026 en 2027', `${r.aowLeeftijd} jaar`]
];
export const EVI_VOORBEELD = `Je winst over 2025 was € 60.000. Je premiegrondslag is € 60.000 min ${euro(r.franchise)} = ${euro(60000-r.franchise)}. Je jaarruimte is ${f.jaarruimtePercentage.waarde}% daarvan: ${euro(Math.round(r.percentage*(60000-r.franchise)))}. Leg je in 2026 € 5.000 in en valt je belastbaar inkomen in de tweede schijf, dan krijg je ongeveer ${euro(5000*f.schijf2Tarief.waarde/100)} terug via je aangifte (${f.schijf2Tarief.waarde.toLocaleString('nl-NL',{minimumFractionDigits:2})}%). Vereenvoudigd voorbeeld: je echte uitkomst hangt af van je hele situatie.`;
export const EVI_KAARTEN = [
 ['Beleggen per leeftijdsgroep', 'Je inleg gaat in een mix van twee fondsen, Kempen Profielfonds 0 (minder risico) en Kempen Profielfonds 5 (meer risico). Naarmate je pensioendatum dichterbij komt, wordt het risico automatisch afgebouwd.'],
 ['Inleggen wanneer jij wilt', 'Je kiest zelf bedrag en moment. Binnen je jaar- en reserveringsruimte is je inleg aftrekbaar.'],
 ['Geen box 3', 'Zolang het geld in je lijfrente zit, valt het buiten box 3.'],
 ['Opbouwen én laten uitkeren', 'Op je pensioendatum zet je de pot om in een lijfrente-uitkering, dat kan ook bij Evi. Over de uitkering betaal je inkomstenbelasting, vaak tegen een lager tarief dan nu.'],
 ['Bestaande pot meenemen', 'Een fiscale oudedagsreserve, stakingswinst of elders opgebouwde lijfrente kun je inbrengen.'],
 ['Online en persoonlijk', 'Je regelt het online en in de app; vermogenscoaches van Evi geven inzicht in je mogelijkheden, de keuze maak je zelf. Evi werkt op basis van execution only: jij geeft de opdracht.']
];
export const EVI_STAPPEN = [
 ['Breng je pensioengat in beeld', 'AOW plus mijnpensioenoverzicht.nl.'], ['Bereken je jaarruimte', 'Rekenhulp hierboven of het hulpmiddel van de Belastingdienst.'],
 ['Kies je inleg', 'Eenmalig, maandelijks of aan het eind van het jaar als je je winst kent.'], ['Open je Lijfrente-opbouw bij Evi', 'Online; ZP Zaken helpt je op weg.'], ['Trek je inleg af in je aangifte', 'Als uitgaven voor inkomensvoorzieningen in box 1.']
];
export const EVI_FAQ = [
 {question:"Moet ik als zzp'er pensioen opbouwen?",answer:"Nee, het is niet verplicht, behalve in een paar beroepen met een verplicht pensioenfonds. Je krijgt wel AOW vanaf de AOW-leeftijd. Voor de meeste zzp'ers is dat te weinig om hun levensstijl vast te houden, daarom bouwen veel zelfstandigen zelf aanvullend pensioen op."},
 {question:"Hoeveel mag ik in 2026 aftrekken voor mijn pensioen?",answer:`Je jaarruimte is ${f.jaarruimtePercentage.waarde}% van je premiegrondslag: je inkomen van 2025 (maximaal ${euro(r.maximumInkomen)}) min ${euro(r.franchise)}. Het maximum ligt rond ${euro(Math.ceil(r.percentage*(r.maximumInkomen-r.franchise)))}. Daarbovenop kun je niet gebruikte ruimte van de afgelopen tien jaar inhalen, in 2026 tot ${euro(r.reserveringMaximum)}.`},
 {question:"Wat is het verschil tussen jaarruimte en reserveringsruimte?",answer:"Jaarruimte is wat je dit jaar mag aftrekken op basis van je inkomen van vorig jaar. Reserveringsruimte is jaarruimte uit de afgelopen tien jaar die je niet hebt gebruikt. Die mag je alsnog inzetten, tot een maximum per jaar."},
 {question:"Wat levert de aftrek mij op?",answer:"Je inleg gaat van je belastbaar inkomen in box 1 af. Je krijgt daardoor belasting terug tegen je eigen tarief, in 2026 35,75%, 37,56% of 49,50%. Later betaal je belasting over de uitkering, vaak tegen een lager tarief."},
 {question:"Wat is een bancaire lijfrente?",answer:"Een geblokkeerde spaar- of beleggingsrekening bij een bank of beleggingsinstelling, speciaal voor je pensioen. Bij Evi van Lanschot beleg je dat geld. Op je pensioendatum koop je er een uitkering van. Overlijd je eerder, dan gaat het tegoed naar je erfgenamen."},
 {question:"Kan ik tussentijds geld opnemen?",answer:`Niet zonder gevolgen. Neem je het geld eerder op, dan betaal je inkomstenbelasting over het hele bedrag en meestal ${f.revisierente.waarde}% revisierente. Leg daarom alleen in wat je echt voor later kunt missen.`},
 {question:"Wat verandert de Wet toekomst pensioenen voor zzp'ers?",answer:"Voor zelfstandigen is vooral de fiscale ruimte gegroeid: de jaarruimte is sinds 2023 30% van de premiegrondslag. De fiscale oudedagsreserve (FOR) kun je sinds 2023 niet meer aanvullen; een bestaande FOR kun je omzetten in een lijfrente."},
 {question:"Wanneer moet ik inleggen om dit jaar belastingvoordeel te krijgen?",answer:"Je inleg moet in het kalenderjaar zelf betaald zijn. Voor aftrek over 2026 dus uiterlijk 31 december 2026."},
 {question:"Wat heeft mijn BAV + AVB met pensioen te maken?",answer:"Beide beschermen je als ondernemer. Een aansprakelijkheidsclaim kan je spaargeld en je pensioenplannen raken. De BAV + AVB van ZP Zaken vangt schade door fouten in je werk op, zodat wat je opbouwt voor later blijft staan."},
 {question:"Wat doet ZP Zaken en wat doet Evi van Lanschot?",answer:"ZP Zaken geeft uitleg, rekent met je mee en brengt je in contact met Evi van Lanschot. Evi beheert je lijfrente-opbouw en belegt in jouw opdracht. De keuze en de inleg bepaal je zelf."}
];
export const EVI_PRODUCT_TEKST = "Evi van Lanschot is het online vermogensbeheer van Van Lanschot Kempen. Met de Lijfrente-opbouw van Evi Persoonlijk Pensioen zet je geld op een geblokkeerde beleggingsrekening die speciaal bedoeld is voor je aanvullend pensioen: een bancaire lijfrente.";
export function eviSchemas() {
 const url = `${SITE_CONFIG.url}${EVI_PAGINA_PAD}`;
 return [breadcrumbSchema([{name:'Home',url:SITE_CONFIG.url+'/'},{name:'Pensioen',url:SITE_CONFIG.url+'/pensioen'},{name:"Pensioen opbouwen als zzp'er",url}]),
 {'@context':'https://schema.org','@type':'Service',name:"Pensioen opbouwen voor zzp'ers met Evi van Lanschot",serviceType:'Informatie en persoonlijke service bij pensioenopbouw in de derde pijler',url,provider:{'@id':ORGANIZATION_ID},areaServed:'NL',audience:{'@type':'BusinessAudience',name:"Zzp'ers en zelfstandigen"}},
 {'@context':'https://schema.org','@type':'FinancialProduct',name:'Lijfrente-opbouw (bancaire lijfrente) van Evi van Lanschot',description:EVI_PRODUCT_TEKST,provider:{'@type':'Organization',name:'Evi van Lanschot',url:'https://www.evivanlanschot.nl'},category:'Bancaire lijfrente, derde pijler',url},faqSchema(EVI_FAQ)];
}
