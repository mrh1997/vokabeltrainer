# Vokabeltrainer

Static SvelteKit app (German UI) for learning vocabulary, deployed to GitHub Pages
from `main` via `.github/workflows/deploy.yml`. See `README.md` for structure.

## After every change: rebuild and show it

After every change to the app, rebuild the site and display it in the CodeHydra simple browser:

1. Run the checks: `npm run check` and `npm test` (plus `npm run test:e2e` for UI changes).
2. Stop any server still listening on port 4173. An old preview server serves outdated
   files, and the e2e tests would reuse it.
3. Rebuild: `npm run build`.
4. Start the preview server without blocking the workspace:
   `ch bg node node_modules/vite/bin/vite.js preview --port 4173 --strictPort`
5. Wait until `http://localhost:4173/vokabeltrainer/` answers with 200, then open the page
   affected by the change:
   `ch ws browser --url http://localhost:4173/vokabeltrainer/<path>`

The app's service worker can keep the previous version until the page is reloaded once;
mention that when reporting.

## Notes

- The site lives under the base path `/vokabeltrainer` (dev server: root).
- Wikimedia rate-limits clients without a proper User-Agent. In Node scripts send one with a
  contact URL (see `scripts/fetch-fixtures.mjs`); browsers are fine.
- Unit-test fixtures (German Wiktionary wikitext) live in `src/lib/lookup/fixtures/`.
  Add new ones with `node scripts/fetch-fixtures.mjs <Wort> …`.
