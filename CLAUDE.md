# Priskalkulator – Eika Økonomi

Internt verktøy for å regne ut månedspris på regnskapstjenester og generere tilbudsark.
Brukes av fem byråer (Eika Økonomi Askim, Eika Økonomi Follo, Odal Økonomi, B-S Regnskap,
Eika Økonomi Midt-Norge) samt et egendefinert byrå.

Kjører som Windows-app (Electron) og som ren HTML-side i Chrome/Edge.

## Det viktigste først

**Rediger kun `priskalkulator.html`.**

`priskalkulator_beskyttet.html` er en *generert* fil: en låseskjerm pluss hele kilden
XOR-kryptert og base64-kodet. Den skal aldri redigeres for hånd. Etter endringer i kilden:

```bash
npm run protect
```

Skriptet bytter ut base64-blobben, dekrypterer resultatet og feiler hvis det ikke er
byte-identisk med kilden. Commit begge filene sammen.

Merk at «beskyttelsen» ikke er reell sikkerhet: kilden ligger i klartekst i samme repo, og
passordhashen står i låseskjermen. Den stopper en tilfeldig kollega, ikke en som vil inn.

## Struktur

Hele applikasjonen er én fil på ~3 100 linjer:

| Del | Sted |
|---|---|
| CSS med design-tokens | `<style>`, linje 8–330 |
| Skjermer og modaler | `<body>`, linje ~330–800 |
| All logikk | siste `<script>`, linje ~800 og ut |

To linjer er base64-kodede logoer på flere hundre kB (`SELSKAP_LOGO`, `LOGO_B64`). Unngå å
lese dem – filtrer dem bort først, f.eks. med
`awk 'length($0)>4000 {print "[kuttet]"; next} {print}' priskalkulator.html`.

Støttefiler: `main.js` (Electron-hovedprosess, IPC, filsystem), `preload.js` (bro mot
renderer), `.github/workflows/build.yml` (bygger installer ved tag).

## Prismotoren

`recalc()` er hjertet. Den leser skjemaet, regner ut alt, oppdaterer sidepanelet og legger
resultatet i den globale `S`, som tilbudsark, Word-eksport og lagring leser fra.

Hovedregler:

- Bilag og fakturaer: `antall × minutter / 60 × timepris`, rundet opp til nærmeste 10 kr
- Lønn: oppslag i `LONN_TABELL` (timer pr måned ut fra antall ansatte) × timepris lønn
- Årlige poster fordeles på måned med `Math.ceil(beløp/12/10)*10`
- Interntid: trappetrinn ut fra antall bilag (`getInternTid`)
- Kurs og avtalt interntid: bakes inn i månedsprisen, men vises **aldri** som egen post i
  tilbudet til kunden. Den ligger i regnskapssummen og i dekningsgradens kostnadsside.
- Dekningsgrad: faktisk tidsbruk × `internKost` + `overhead`, mot månedsprisen

I tilbudsarket regnes «Avtalt tjenesteleveranse» som *restbeløpet* av månedsprisen etter
årsoppgjør og rådgivning. Det er bevisst: da summerer postene alltid til totalen, uansett
hvilke interne poster som er med.

## Priser

`DEFAULTS` i koden er utgangspunktet. Endringer brukeren gjør i ⚙ Priser lagres pr byrå i
`priser.json` – i lagringsmappen, eller i programmets datamappe i Electron.

`?p=`-parameteren i URL-en bærer prisene som base64 slik at de kan deles med en lenke
(«Kopier min lenke»). En delt lenke overstyrer lagrede priser for økten, men overskriver
dem ikke på disk.

Endrer du `DEFAULTS`, husk at `PRIS_LABELS` styrer hvilke nøkler den årlige KPI-justeringen
tar med. Den lista er i dag ufullstendig – se Kjente svakheter.

## Lagring

Tre moduser, valgt automatisk i denne rekkefølgen:

1. **Electron** – filer i `Dokumenter/Priskalkulator/` via IPC i `main.js`
2. **Filsystem** – mappe brukeren velger, via File System Access API (kun Chrome/Edge)
3. **localStorage** – fallback

Les og skriv alltid gjennom `getTilbudById()`, `getAlleTilbud()` og `lagreTilbudData()`.
Direkte `localStorage`-oppslag virker bare i én av tre moduser og har vært kilde til feil før.

## Utgivelse

```bash
npm version 1.0.17 --no-git-tag-version   # bump i package.json
git commit -am "Bump version to 1.0.17"
git tag v1.0.17 && git push --tags
```

Tag som starter med `v` trigger GitHub Actions, som bygger Windows-installer og lager en
release. Appen sjekker selv `releases/latest` ved oppstart og viser en nedlastingsbanner.

Nettleserversjonen har ingen utgivelse – der er `main` det som gjelder.

## Kjente svakheter

- **Tre kopier av tilbudsrenderingen.** `renderTilbud()`, `exportWord()` og
  `_renderReadOnlyTilbudHtml()` bygger den samme pristabellen hver for seg. Endrer du én,
  må du endre de andre. Bør slås sammen til én funksjon som returnerer radene.
- **`recalc()` er ikke testbar.** Den leser DOM direkte. Å skille ut en ren
  `beregn(input, priser)` ville gjort prismotoren mulig å teste – i dag finnes ingen tester.
- **`PRIS_LABELS` mangler nøkler.** `kursTimepris`, `kursTimer` og `internTidTrinn` er ikke
  med, så den årlige prisjusteringen hopper over dem.
- **GitHub-brukernavnet er hardkodet** fire steder (`main.js` to ganger,
  `priskalkulator.html`, `publish.owner` i `package.json`). Må endres hvis repoet flyttes.
- **SheetJS lastes fra CDN.** Uten nett faller Excel-import tilbake til CSV. Biblioteket
  bør legges lokalt.
- **Bulk-importerte kunder får `_mndPris: 0`** til noen åpner dem, så totalene i
  kundeoversikt og dashboard blir for lave inntil da.

## Konvensjoner

Norsk i grensesnitt, kommentarer og commit-meldinger. Ingen byggesteg og ingen
avhengigheter i nettleserversjonen – alt skal fungere ved å åpne HTML-filen direkte.
Koden er kompakt med korte variabelnavn; følg stilen i filen framfor å innføre en ny.
