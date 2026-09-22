# HYOPE — Your daily rotation

A responsive streetwear outfit generator built from the user's real FigJam wardrobe.

## Run locally

Node 22.13+ (Node 24 recommended):

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steep_raza.sql
npm run dev
```

Apply the initial local migration once, not on each restart. Visit the printed localhost URL and use the Sign in link. Local development uses the starter's explicit local test identity. Production uses Sites' authenticated identity and private access controls. Local data is distinct from production data.

## Architecture and storage

React 19 + TypeScript on Vinext/Vite, using the Next App Router API and Cloudflare Workers. This stack supplies responsive client interaction, server-side validation, durable D1 records, and R2 photos in one deployment. Existing bundled Radix/Shadcn primitives provide accessible dialogs, selections, checkboxes and tabs.

- `lib/wardrobe.ts`: stable inventory and editable descriptive metadata.
- `data/import-manifest.json`: source nodes, section references, visible image hashes.
- `public/wardrobe/`: 39 durable individual PNG garment exports. No temporary URLs at runtime.
- `lib/stylist.ts`: pure recommendation engine, independent of UI and storage.
- `app/page.tsx`: Today, results, wardrobe and saved/worn views.
- `app/api/state`: per-user D1 persistence; optimistic revisions prevent silent stale-tab overwrites.
- `app/api/upload` and `app/api/image/[id]`: authenticated R2 photo writes/reads with content signatures and size limits.
- `app/api/weather`: authenticated Open-Meteo weather, with a direct public-provider recovery path when server egress fails. City search lists distinct city/region/country matches and works without device location permission. A selected city is used until Use my location is chosen; Generate or Save preferences persists it through the existing weather record. Saved cities are re-resolved by exact label on reload; no ambiguous/default city is substituted. Both paths validate conditions and the provider observation timestamp, and reject stale weather.
- `lib/validation.ts`: limits and inventory-reference integrity at the persistence boundary.
- `db/schema.ts` and `drizzle/`: schema and generated migration.

The private Sites deployment provisions the `DB` and `BUCKET` bindings declared in `.openai/hosting.json`. No Figma credential, AI key, or weather secret is required at runtime. Open-Meteo's keyless endpoint is used for this personal, noncommercial app; a commercial rollout needs a suitable weather service plan. Never put paid API keys into client code.

Product records are server-side; browser storage is not the source of truth. Preferences save with Generate or Save preferences. Fresh weather saves with other app changes. Exact device coordinates are not persisted; requests round coordinates to city-scale precision. Uploaded images are private to the authenticated user. Deleting a wardrobe item also removes dependent saved fits and their wear history, after confirmation. Uploaded bytes may remain as unreferenced objects after removing or replacing photos; no background garbage collector is included.

## Import audit

Board: `sNEJUjqn3oLAfz7ZNQsY8C`. Only the six requested section subtrees were inspected. They contained 39 image rectangles and no descriptive item text: 3 pants, 18 tees, 4 caps, 7 shoes, 4 crewnecks, 3 hoodies. Hidden earlier image fills were excluded. All visible image hashes are distinct. A visual contact-sheet review confirmed that similar tees have different graphics, and similar sneakers have different colors/panel details. No obvious duplicate garment was merged.

Original-byte extraction was attempted; processed image fills did not consistently return bytes. Temporary download URLs then returned empty bodies. Final assets are isolated per-item PNG exports delivered directly through Figma MCP, not section screenshots. Each file was decoded and validated locally. Garment proportions remain unchanged. Inventory photos use object-fit: contain; outfit previews share one proportional drawing scale. Visible alpha bounds exclude transparent export margins from sizing. Tee, crewneck, hoodie and pants lengths follow approximate category proportions, while accessories use proportional widths. These are visual estimates, not measured garment dimensions. Adding a layer changes placement without independently shrinking the tee. No board writes, stock images, generated garments or inferred fabric/brand claims.

Names describe visible features. Fit, warmth and surface texture are estimates; material defaults to Unknown. Waterproofing and insulation default to unverified and can only be confirmed in the editor. The category list also supports outerwear uploads so weather gaps can be resolved.

## Product references

The item editor accepts an optional public HTTPS product URL. Get details reads product JSON-LD or page metadata and retains a plain-text reference (name, description, brand, material, color, SKU, source and fetch date). It automatically fills the editor’s name, editable brand, notes, explicit material composition, and unambiguous supported category, color, accent, fit, graphics and texture options. A field edited while fetching is preserved. Saved references can be applied again with Fill fields from product details. Fields without a clear match, photos, warmth, protection flags and review status stay unchanged. Save piece persists the reviewed editor values and reference. Old inventory records remain compatible without these optional fields.

The authenticated server reader uses no API keys, validates public destinations and each redirect, checks DNS addresses, forwards no user cookies, and limits response size and duration. Shops requiring sign-in, blocking automated access, or rendering details only through JavaScript may not return details; the URL can still be saved. Retrieved claims are attributed to the page and require checking the exact product version. If fetching fails, the editor opens a paste-from-page fallback, also available at any time. It parses a product title, labeled specifications (including separate-line StockX-style labels), and description locally, then uses the same conservative autofill rules. Descriptive paragraphs can supply a leading product name before common descriptive verbs, with recognized brands matched against that product name rather than background stories. Shoe-specific low-cut/high-cut wording maps to the silhouette, and explicitly stated upper materials retain their scope. Reapplying an older reference uses the same enrichment without requiring a new paste. Pasted references are marked as pasted, retain an optional original HTTPS product URL, and persist only when Save piece is used. Multi-color colorways are retained as reference text without guessing a dominant color. Product screenshots can be dropped or selected as PNG/JPEG/WebP (8 MB, 20 megapixels maximum). Tesseract.js reads English text in a browser worker with self-hosted OCR assets generated from pinned packages by scripts/prepare-ocr.mjs before dev/build. No screenshot is sent to an OCR service or saved as the garment photo. Users review extracted text before applying it; screenshot provenance and an optional source URL persist with the saved reference. Recognition has cancellation, a two-minute timeout, empty-text feedback and size limits. This reads visible text, not fabric or product identity from a photo alone.

## Recommendation approach

A rules-based engine samples and ranks candidate combinations. It always requires owned tee, pants and shoes; adds a cap when selected; and automatically adds a hoodie or crewneck below 18°C feels-like. It scores neutral/tonal coordination, repeated accents, silhouette, graphic balance and style direction. It reduces recent worn-item reuse and penalizes overlap across the three selected looks. Exact combinations already generated in the active session are excluded. Locks override sampling but cannot refer to missing records or occupy the same slot twice.

Research was read before scoring rules were defined:

- [MR PORTER — How to experiment with the oversized look](https://www.mrporter.com/en-au/journal/fashion/dieworkwear-how-to-experiment-with-oversized-24929938): outfit proportions, visible hems and waist definition.
- [British GQ — How to layer](https://www.gq-magazine.co.uk/article/how-to-layer): coherent proportions, surface contrast, one focal point and controlled layering.
- [GQ — Refresh your work wardrobe](https://www.gq.com/story/refresh-your-work-wardrobe): tonal combinations.

Numerical scores are the app's interpretation, not rules asserted by the sources. No AI service is called. Labels and rationales are derived from the selected inventory records. Texture contributes styling notes; it does not assert fabric composition.

Weather uses current temperature, feels-like, precipitation, wind, humidity and daylight. Season supports the advice. After-dark advice follows the weather’s daylight flag. Weather refreshes on opening, every 15 minutes while visible, and when returning to the app. Generation requires a fresh observation under 30 minutes old. Location/weather failures show a retry message and city search. Refresh also retries after returning online, and a still-fresh observation is retained if refresh fails. Saved fits retain their recorded conditions, while regeneration uses current local weather. Legacy setting, occasion, time and temperature-comfort preferences remain compatible with stored records but no longer affect recommendations. These are comfort estimates, not performance guarantees. Cold, rain and strong wind surface protection gaps; proposed additions stay separate and labeled as not owned.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
./node_modules/esbuild/bin/esbuild tests/stylist.test.ts --bundle --platform=node --format=esm --outfile=/tmp/hyope-tests.mjs
node --test /tmp/hyope-tests.mjs
python3 tests/api-smoke.py
npm run build
```

The API smoke script is for the initial local 39-item wardrobe only. It snapshots/restores local inventory and checks auth, upload/read, add/edit/reload/remove, stale-write rejection, input validation and weather/fallback. Do not point it at production.

Browser verification: generate three looks → lock → regenerate → swap → save → mark worn → reload → retrieve favorite and worn date. Mobile (390px) and desktop layouts and image rendering were inspected. The former detailed weather editor has been removed in favor of automatic local weather. The read-only WebMCP wardrobe tool was tested with valid and invalid input. Automated cases cover missing inventory, duplicate/missing locks, hot locked layers, freezing rain, high wind, automatic layering, ignored legacy preferences and exhausted combinations.
