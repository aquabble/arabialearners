
# ArabiaLearners — Fixed API & Glossary Wiring

This rebuild contains critical fixes so `/api/sentence-bundle` actually filters vocab by **Semester → Unit → Chapter** and uses OpenAI when your key is configured.

## What was fixed

1. **Glossary shape normalizer**
   - Added a resilient parser in `api/_lib.cjs` that understands BOTH:
     - A multi-section array where `{ type: "Semesters" }` holds items, and/or `{ type: "Glossary" }` holds `semesters`.
     - A single-object style with `semesters` or `units`.
   - New helpers: `getSemestersList()` and `normalizeGlossaryForUI()`.

2. **Unit/Chapter filtering**
   - `extractLexicon()` now uses `getSemestersList(...)` so unit/chapter narrowing works regardless of which file `loadGlossary()` picks.

3. **/api/glossary endpoint**
   - Switched to `require("./_lib.cjs")` and returns `{ semesters: [...] }` using `normalizeGlossaryForUI(...)`.

4. **/api/diag conflict**
   - Replaced `api/diag.cjs` with `api/diag.js` to avoid Vercel path conflicts.

## Environment variables (Vercel → Project → Settings → Environment Variables)

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (optional; default: `https://api.openai.com/v1`)

## Smoke tests

- `GET /api/diag` → should show `hasOpenAIKey`, `glossaryFoundAt` and `hasGlossary: true`.
- `GET /api/glossary` → returns a skeleton `{ semesters:[{ id, name, units:[{ id, name, chapters:[...] }]}] }`.
- `POST /api/sentence-bundle` body:
  ```json
  { "unit":"Unit 3", "chapter":"Chapter 2", "size":4, "direction":"ar2en", "difficulty":"medium" }
  ```
  Should return `{ meta: { llm: true, ... }, items:[ ... 4 items ... ] }` when the key is set; otherwise it falls back to local generator.
