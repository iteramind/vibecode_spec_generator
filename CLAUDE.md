# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vibe Scaffold** is a Next.js 16 (App Router) app that generates spec documents through a 4-step AI wizard: One Pager → Dev Spec → Prompt Plan → AGENTS.md. Each step is chat → generate markdown doc → approve, and approved docs feed into later steps as context.

## Commands

```bash
npm run dev               # http://localhost:3000
npm run build             # runs cleanup-test-data, then next build (type-checks)
npm run lint
npm test                  # vitest run (all tests)
npm run test:watch
npx vitest run tests/unit/store.test.ts        # single file
npx vitest run -t "approveStep"                # tests matching a name
node scripts/run-migration.mjs migrations/004_chat_logs.sql   # apply a SQL migration
```

**Warning:** `npm run build` first runs `scripts/cleanup-test-data.mjs`, which **DELETEs rows** from `user_events`, `chat_logs`, `spec_metadata` and `subscribers` for every client ID listed in `excluded-client-ids.txt`, against whatever Postgres the env points at. Keep this in mind before building with production credentials.

## Environment

See `.env.example`. `ANTHROPIC_API_KEY` is required. `ANTHROPIC_MODEL` is optional (every AI route falls back to `claude-opus-5-5`). Also optional: `NEXT_PUBLIC_GA_ID`, `SPIKELOG_API_KEY`, `RESEND_API_KEY` (used by log-metadata email notifications), and the Vercel Postgres vars (`POSTGRES_URL` etc., read implicitly by `@vercel/postgres`).

## Architecture

### Wizard state
- Zustand store with `persist` in `app/store.ts`, localStorage key **`wizard-storage`**. Changing that key wipes all users' saved progress. `isGenerating` is deliberately not persisted.
- `steps` has four `StepData` entries (`chatHistory`, `generatedDoc`, `approved`) under the keys `onePager`, `devSpec`, `checklist`, `agentsMd`. Note that the "Prompt Plan" step is stored as `checklist`.
- `stepKeyMap` in `app/wizard/page.tsx` maps step index to store key, and `stepConfigs` in the same file maps it to config. The step count is hardcoded in `stepKeyMap`, `WizardState["steps"]` (`app/types.ts`), and the store's initial state. Change all three together.
- Step gating (a step is reachable only once the previous one is approved) lives in `app/wizard/utils/stepAccess.ts`.

### Step configs drive AI behavior
`app/wizard/steps/step{1-4}-config.ts` export a `StepConfig` (see `app/types.ts`): `systemPrompt` (chat), `generationPrompt` (doc output format), `documentInputs` (keys of earlier steps whose docs are injected as context), plus UI text (`initialGreeting`, `inputPlaceholder`, `quickStartSuggestions`, etc.). Change prompts here, not in the API routes. `WizardStep.tsx` is generic across all steps.

### Chat and generation flow
- `WizardStep.tsx` renders **`ChatInterfaceWithOptions`** for Step 1 (`onePager`) and plain **`ChatInterface`** for the others. Both stream from `/api/chat` with a manual `fetch` + `ReadableStream` reader. They don't use `useChat` (SDK compatibility), and both also POST transcripts to `/api/log-chat`.
- The Step 1 multiple-choice UI: `app/hooks/useQuestionOptions.ts` pulls the last `?` line from the assistant message and calls `/api/generate-options`. That route uses `streamObject` with the Zod schema in `app/schemas/questionOptions.ts`, which allows 3–6 options, rejects "Other"/"None of the above" and duplicates, and includes a `recommendedIndex`. The client consumes it with `@ai-sdk/react`'s `experimental_useObject`.
- `WizardStep.tsx` calls `/api/generate-doc` (streamed markdown) using chat history + `documentInputs` docs + `generationPrompt`.
- On completion, `app/wizard/page.tsx` posts parsed spec metadata (`app/utils/parseSpecMetadata.ts`) to `/api/log-metadata`.

### API routes: two runtimes
- **Edge** (`export const runtime = "edge"`, no Node APIs): `chat`, `generate-doc`, `generate-options`, `validate-license`. All AI calls go through `@ai-sdk/anthropic`. Anthropic only, OpenAI is forbidden.
- **Node** (use `sql` from `@vercel/postgres`): `track-event`, `log-chat`, `log-metadata` (also sends email via Resend), `subscribe`. `spikelog` proxies metrics to Spikelog.
- Schema lives in `migrations/*.sql` (tables `user_events`, `chat_logs`, `spec_metadata`, `subscribers`, all keyed by `client_id`). Add new numbered migrations rather than editing old ones.

### Analytics
`app/utils/analytics.ts` sends each event to GA4 (`gtag`) and also to `/api/track-event`, which writes to Postgres. Event names are listed in `ANALYTICS.md`. `analytics-queries.sql` has the reporting queries.

### Downloads
Filenames are `stepName.toUpperCase().replace(/\s+/g, '_') + '.md'` (e.g. `ONE_PAGER.md`), both for single downloads and the JSZip bundle in `app/wizard/page.tsx`. "Load Sample Docs" fills all steps from `app/wizard/utils/sampleDocs.ts`.

## Testing

Vitest + Testing Library on happy-dom. `tests/setup.ts` holds global mocks, and the `@` alias resolves to the repo root. Unit tests live in `tests/unit/` (store, components, hooks, schemas, utils) and API route tests in `tests/integration/api/`, which mock the AI SDK and `@vercel/postgres`. All tests must pass before committing, and new features need tests.

## Constraints

- Tailwind **v3.4** (not v4) because of PostCSS compatibility.
- Don't add Node APIs to Edge routes, and don't move Postgres routes to Edge.
- Ask before changing `wizard-storage`, reordering `stepKeyMap`, or removing a step config.
- Update `AGENTS.md` if the architecture changes significantly.
