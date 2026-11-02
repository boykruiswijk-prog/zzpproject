# Factuurplanner 2 november 2026

## Ochtendonderzoek
- Cron job 20 startte 05:00:00.238735 UTC en meldde succeeded om 05:00:00.294933 UTC. Dat bewijst alleen het plaatsen van de HTTP-opdracht.
- HTTP-opdracht 6517 meldt timeout na 5000 ms (5001.064 ms totaal). De functie werkte daarna door: laatste opgeslagen concept 05:03:23.594 UTC, dus minimaal circa 203 seconden na de cronstart.
- Geen functie- of analytische logs beschikbaar voor deze ochtendrun. Geen runrij en geen planner-/Exact-mail in beide maillogs. Exacte runtime-stopreden en harde maximumlooptijd zijn daarom niet bewezen; een harde stop past bij de waarnemingen. Geen destructieve timeoutproef tegen live facturatie uitgevoerd.
- Voor herstel: 87 van de 121 regels aangemaakt voor EUR 6324,50; 34 tijdelijk voor EUR 2255; 13 beschikbare kandidaten voor 2 november voor EUR 1215.

## Herstel
- Runlease/startregistratie vóór Exact; checkpoint na elke geclaimde factuur; onderbroken run blijft bewaard.
- 90 seconden werkbudget, maximaal 20 factuurkandidaten, 10 seconden per Exact-verzoek. Retry-After die niet past wordt uitgesteld vóór wachten; onzekere POST blijft geclaimd en wordt nooit blind herhaald.
- Achterstallig/vandaag om en om; ongewijzigde bedragen, payloads, schakelaar en sleutelcontroles.
- Samenvattingsmail ook bij gedeeltelijke run, bestaande gedetailleerde boekingsmail afgewacht.
- Alleen bij resterend werk een Vault-gebonden vervolgtaak elke drie minuten; na drain verwijderd. Dagelijkse cron blijft behouden.
- Alleen factuur-planner uitgerold; geen websitepublicatie.

## Live herstelruns
| Start UTC | Beschikbare kandidaten | Aangemaakt | Tijdelijk | Fouten | Resterend |
|---|---:|---:|---:|---:|---:|
| 06:29:19 | 47 | 20 | 0 | 0 | 27 |
| 06:30:26 | 27 | 20 | 0 | 0 | 7 |
| 06:31:29 | 7 | 7 | 0 | 0 | 0 |

Alle runs HTTP 200; duur inclusief mails 57,76 / 54,22 / 89,32 seconden. Roxy: drie samenvattingen en drie bestaande boekingslijsten als sent gelogd met bericht-ID.

## Eindcontrole met SELECT
- 1 november: 180 concept_aangemaakt, EUR 12488,50; 121 vervangen historische rijen, EUR 8579,50; nul tijdelijk/geclaimd/fout.
- 2 november: 13 concept_aangemaakt, EUR 1215; nul tijdelijk/geclaimd/fout.
- Nul dubbele planningssleutels; nul dubbele niet-vervangen/niet-tijdelijke contract-perioden. Historische vervangingen behouden.
- Geen beschikbare factuurkandidaten resterend; vervolgcron verwijderd.
- Eén standmelding 33f0beb4-95db-42fe-b3cc-9d324862f9bb voor Ellen en Roxy, omdat de ochtendmail ontbreekt; beiden sent om 06:33:14/15 UTC.

## Verificatie
- Finale volledige suite inclusief SQL-regressies: 1907 geslaagd, 1 bestaande overgeslagen; 181 testbestanden geslaagd.
- Automatische frontendcontrole build OK; Deno check van factuur-planner schoon.
- SQL-regressies bevestigen overlapweigering, behouden onderbroken run en uitsluitend service-toegang. Geen dubbele Exact-invoice-ID's in planning.