# Vokabeltrainer

Static web app for learning vocabulary of any language with a 5-box flash card system.
The UI is German. Live: https://mrh1997.github.io/vokabeltrainer/

## How it works

- **Adding words** looks up German Wiktionary live from the browser: completion, translations
  (with gender and meaning), special forms from the inflection tables, and the pronunciation.
  The mp3 comes from Wikimedia Commons (Lingua Libre preferred). If nobody recorded the whole
  answer ("le chien", "je vais"), single-word recordings are joined, by one speaker where possible.
  Cards without a recording (older ones, special forms) get one in the background while online.
  For playback the device's own (offline) speech voice is preferred if it has one for the
  language; the recording is used otherwise.
- **Everything is stored locally** in IndexedDB: cards, progress and audio recordings.
  The quiz therefore works offline. A service worker caches the app itself.
  Backup/restore is available as a JSON file on each language page.
- **Quiz:** exact answer required. Right → one box up; wrong → box 1. Cards are drawn randomly
  with fixed shares per box: 40 / 25 / 17 / 12 / 6 %. Quizzing is only possible while box 1 holds
  a card; once it is empty the round ends. Only the German word is shown (no meaning until
  answered); nouns carry the article matching the answer ("der Hund" → "le chien",
  "ein Hund" → "a dog"), special forms are asked by their German counterpart ("Mäuse" → "mice",
  "ich gehe" → "je vais"). English nouns that take no "a/an" (names, uncountable nouns, plurals)
  are asked and answered without article ("Montag" → "Monday"). Cards saved under older rules are
  looked up again once.

## Structure

| Path | Responsibility |
|---|---|
| `src/lib/lookup/` | Wiktionary/Commons access, wikitext parsing, article rules and special forms |
| `src/lib/db/` | IndexedDB storage of cards, progress, audio; backup |
| `src/lib/quiz/` | Box rules, weighted random selection, answer check, calendar weeks |
| `src/lib/audio/` | Playback (device voice first, recording otherwise), joining word recordings, fetching missing recordings |
| `src/routes/` | Pages: language choice, language menu, add, quiz, Impressum |
| `src/service-worker.ts` | Offline cache of the app shell |

## Development

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
LIVE=1 npx vitest run src/lib/lookup/live.test.ts   # checks against the real Wikimedia APIs
npx playwright install chromium && npm run test:e2e  # end-to-end tests (desktop + phone)
node scripts/fetch-fixtures.mjs <Wort> …             # store Wiktionary pages as test fixtures
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Data sources

Wiktionary, Wikidata, Wikimedia Commons (CC BY-SA). See the Impressum page in the app.
