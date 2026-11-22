# Vokabeltrainer

Static web app for learning vocabulary of any language with a 5-box flash card system.
The UI is German. Live: https://mrh1997.github.io/vokabeltrainer/

## How it works

- **Adding words** looks up German Wiktionary live from the browser: completion, translations
  (with gender and meaning), special forms from the inflection tables, and the pronunciation.
  The mp3 comes from Wikimedia Commons (Lingua Libre preferred). If nobody recorded the whole
  answer ("le chien", "je vais"), single-word recordings are joined, by one speaker where possible.
  Cards without a recording (older ones, special forms) get one in the background while online.
  Speech synthesis of the device is only the last resort.
- **Everything is stored locally** in IndexedDB: cards, progress and audio recordings.
  The quiz therefore works offline. A service worker caches the app itself.
  Backup/restore is available as a JSON file on each language page.
- **Quiz:** exact answer required. Right → one box up; wrong → box 1. Cards are drawn randomly
  with fixed shares per box: 40 / 25 / 17 / 12 / 6 %.

## Structure

| Path | Responsibility |
|---|---|
| `src/lib/lookup/` | Wiktionary/Commons access, wikitext parsing, article rules and special forms |
| `src/lib/db/` | IndexedDB storage of cards, progress, audio; backup |
| `src/lib/quiz/` | Box rules, weighted random selection, answer check, calendar weeks |
| `src/lib/audio/` | Playback, joining word recordings, fetching missing recordings; speech synthesis as fallback |
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
