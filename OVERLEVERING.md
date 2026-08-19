# Overlevering av Priskalkulatoren

Dette dokumentet er skrevet ved overlevering fra Henrik Strøm. Det beskriver hva du overtar,
hva du må gjøre først, og hva som er åpne spørsmål.

Se `CLAUDE.md` for hvordan koden henger sammen.

## Hva du overtar

- **Repo:** `Priskalkulator-E-` på GitHub. Kildekoden, byggeoppsettet og alle utgivelser.
- **Windows-appen:** installeres fra siste release. Sjekker selv etter oppdateringer.
- **Nettleserversjonen:** `priskalkulator.html` åpnet i Chrome eller Edge.
- **Kundedata:** ligger *ikke* i repoet. Hver bruker har sine tilbud lokalt, i
  `Dokumenter/Priskalkulator/` eller i en lagringsmappe de selv har valgt. Skal data følge
  med, må mappen kopieres separat.

## Gjør dette først

1. **Overta GitHub-tilgangen.** Repoet må enten overføres til deg eller du må legges til
   som eier. Uten det kan du ikke lage utgivelser.
2. **Brukernavnet er allerede byttet til `Kornelijacive`** fire steder: to i `main.js`,
   én i `priskalkulator.html`, og `publish.owner` i `package.json`. Disse peker på
   `Kornelijacive/Priskalkulator-E-` og virker først når overføringen i punkt 1 er
   fullført. Fram til da feiler versjonssjekken stille – begge kallene har feilhåndtering,
   så appen fungerer som normalt, den viser bare ingen oppdateringsbanner.
3. **Vurder om repoet skal være offentlig.** Det er offentlig i dag. Det betyr at hele
   prismodellen – timepriser, fastpriser og interne kostnadssatser for alle fem byråene –
   er lesbar for hvem som helst. Auto-oppdateringen henter installeren fra release-siden,
   og et offentlig repo er den enkleste måten å få det til på, men det er en avveining som
   bør tas bevisst.
4. **Passordet til den beskyttede filen** oppgis muntlig ved overlevering. Det er lagret
   som SHA-256-hash i låseskjermen i kilden. Skal det byttes, endres hashen i
   `priskalkulator.html` og filen regenereres med `npm run protect`.

## Utgivelsen ligger bak koden

Siste utgivelse er **v1.0.16**, men `main` har **29 commits** etter den. Brukere som kjører
Windows-appen har altså ikke det som ligger i koden nå. Første utgivelse fra din side bør
derfor være en samlet oppdatering – se utgivelsesoppskriften i `CLAUDE.md`.

Endringene som ennå ikke er sluppet inkluderer blant annet bulk-import fra Excel, ny
struktur på tilbudsarket, varig lagring av priser, mørk modus og en rekke prisrettelser.

## Ting som er verdt å vite

- **To HTML-filer, én kilde.** `priskalkulator_beskyttet.html` genereres av
  `npm run protect`. Rediger den aldri direkte.
- **Det gamle `encrypt.sh` er fjernet.** Det pekte på en utdatert sti og virket ikke.
  `scripts/protect.js` erstatter det og verifiserer resultatet.
- **Ingen tester.** Prismotoren er ikke dekket av noe automatisk. Endrer du på beregninger,
  kontroller manuelt at postene i tilbudsarket fortsatt summerer til totalen.
- **Kurs og avtalt interntid** er en intern kostnad som er bakt inn i månedsprisen, men som
  bevisst ikke vises som egen post overfor kunden. Det er ikke en feil.
- **Prisene revideres jevnlig.** Kalkulatoren har egen funksjon for KPI-justering under
  ⚙ Priser, med forhåndsvisning før den brukes.

## Anbefalt neste steg i koden

Prioritert, fra `CLAUDE.md`s liste over kjente svakheter:

1. Slå sammen de tre kopiene av tilbudsrenderingen til én funksjon. Den duplikasjonen har
   allerede ført til at poster manglet i tilbudet uten at summen stemte.
2. Skill `recalc()` i en ren beregningsfunksjon og en DOM-oppdatering, og legg på noen
   tester av prismotoren.
3. Fyll ut `PRIS_LABELS` slik at KPI-justeringen faktisk treffer alle prisene.
