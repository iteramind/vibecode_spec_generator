# Vibe Scaffold

[![GitHub Repo stars](https://img.shields.io/github/stars/iteramind/vibecode_spec_generator?label=Stars&logo=github)](https://github.com/iteramind/vibecode_spec_generator)

A Next.js app with a 4-step wizard. In each step you chat with Claude about your project, then generate a technical specification document from that conversation.

AI coding tools tend to give "close but not quite right" results when the idea in your head never made it onto paper. Vibe Scaffold walks you through writing it down: it refines the idea into a one-pager, turns that into a technical architecture, then produces a staged development plan and an `AGENTS.md` that a coding agent can follow.

> This repository is the [iteramind](https://github.com/iteramind) fork of [benjaminshoemaker/vibecode_spec_generator](https://github.com/benjaminshoemaker/vibecode_spec_generator). The upstream project runs at [vibescaffold.dev](https://vibescaffold.dev/).

## Quick Start

```bash
git clone https://github.com/iteramind/vibecode_spec_generator.git
cd vibecode_spec_generator
npm install
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Generate Your First Spec** (or **Get Started**) to open the wizard.

## Screenshots

![Vibe Scaffold landing page](./public/scaffold_landing.png)
![Wizard step 1](./public/scaffold_step1.png)

## Features

- **4-step sequential workflow.** Each step receives the earlier steps' documents as context.
  - **Step 1, One Pager:** product vision, target audience, MVP requirements
  - **Step 2, Dev Spec:** technical architecture, API design, data models, implementation details
  - **Step 3, Prompt Plan:** a staged development plan with LLM-ready prompts and checklists
  - **Step 4, AGENTS.md:** guidance and workflow documentation for coding agents
- **AI chat with Claude.** Replies stream in as they're generated.
- **Answer suggestions.** The assistant can propose 3–6 multiple-choice answers to its own questions (`/api/generate-options`).
- **Saved progress.** The wizard state lives in your browser's localStorage, so a refresh doesn't lose anything.
- **Downloads.** Download a single document (`ONE_PAGER.md` and so on) or all of them as a ZIP.
- **Markdown preview.** Switch between rendered and raw views.
- **Step locking.** You approve each step before the next one unlocks.
- **Example documents.** Each step can show a sample of the expected output.

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router); API routes on the Edge Runtime |
| UI | React 19, TypeScript 5, Tailwind CSS 3.4 |
| AI | Vercel AI SDK (`ai` v5) with `@ai-sdk/anthropic` |
| Model | Claude Opus 5.5 (`claude-opus-5-5`), changeable with `ANTHROPIC_MODEL` |
| State | Zustand, persisted to localStorage |
| Optional services | Postgres (`@vercel/postgres`), Resend, Google Analytics, Spikelog |
| Tests | Vitest 4 with Testing Library and happy-dom |

## Prerequisites

- **Node.js 20.9 or newer.** Next.js 16 requires it; Node 22 is tested.
- **An Anthropic API key.** Create one in the [Claude Console](https://console.anthropic.com/).

## Configuration

Copy `.env.example` to `.env.local` and fill it in. Only the API key is required.

| Variable | Required | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Authenticates every Claude call. Without it, chat, document generation and answer suggestions all fail. |
| `ANTHROPIC_MODEL` | No | Model for all three AI routes. Defaults to `claude-opus-5-5`. |
| `POSTGRES_URL` | No | Database for analytics, chat logs and email sign-ups (see [Database](#database-optional)). Read by `@vercel/postgres`. |
| `RESEND_API_KEY` | No | Sends an email each time someone generates a spec (see the caution under [Database](#database-optional)). |
| `NEXT_PUBLIC_GA_ID` | No | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). The tracking script loads only when it's set. |
| `SPIKELOG_API_KEY` | No | Sends API response-time and usage metrics to Spikelog. |

Restart `npm run dev` after changing any of these.

### Choosing a model

Prices are Anthropic's API rates per million input/output tokens, as of October 2026.

| Model | `ANTHROPIC_MODEL` | Input / output | Notes |
|---|---|---|---|
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | Default. Anthropic's recommended general model. |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 / $10 | Faster and cheaper; a little less thorough on the long documents. |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.10 / $0.50 | Cheapest; built for short, high-volume tasks rather than long specs. |

Check [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing) for current rates.

Opus 5.5 and Sonnet 5.5 reject forced tool calls, which older versions of `@ai-sdk/anthropic` used to produce JSON. Keep `@ai-sdk/anthropic` at **2.0.109 or newer**, or `/api/generate-options` returns an empty response.

## Deployment

The app deploys as a standard Next.js project. Vercel is the simplest host, because the API routes run on the Edge Runtime and the database client is `@vercel/postgres`.

### Deploy to Vercel (dashboard)

1. Push your branch to GitHub.
2. In [Vercel](https://vercel.com/new), click **Add New → Project** and import `iteramind/vibecode_spec_generator`. Vercel detects Next.js; keep the default build settings.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY`. Add any optional variables from [Configuration](#configuration) you want.
4. Click **Deploy**.
5. To use your own domain, add it under **Project → Settings → Domains**.

After this, every push to `main` deploys to production, and every other branch or pull request gets its own preview URL.

### Deploy to Vercel (CLI)

```bash
npm i -g vercel
vercel link                                   # connect this folder to a Vercel project
vercel env add ANTHROPIC_API_KEY production   # paste the key when prompted
vercel                                        # preview deployment
vercel --prod                                 # production deployment
```

Add the same variables to the `preview` environment if you want preview deployments to work too.

### Database (optional)

The core wizard doesn't need a database. Without one, the build and deploy still succeed, and the chat, generation and download features all work. Only the optional logging routes (`/api/track-event`, `/api/log-chat`, `/api/log-metadata`, `/api/subscribe`) fail, and they log the error without affecting the wizard.

To turn them on:

1. **Create a Postgres database.** On Vercel, add **Neon** from **Storage** (or the Marketplace) and connect it to the project. That sets `POSTGRES_URL` for you. For local development, run `vercel env pull .env.local` to copy it down.
2. **Create the base tables.** `subscribers` and `spec_metadata` aren't created by any file in `migrations/`. This SQL matches the columns the code writes:

   ```sql
   CREATE TABLE IF NOT EXISTS subscribers (
     id SERIAL PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS spec_metadata (
     id SERIAL PRIMARY KEY,
     app_name TEXT,
     problem TEXT,
     ideal_user TEXT,
     platform TEXT,
     tech_stack TEXT[],
     integration_count INTEGER,
     complexity_tier TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Run the migrations in order**, with `POSTGRES_URL` set in your shell:

   ```bash
   node scripts/run-migration.mjs migrations/001_user_events.sql
   node scripts/run-migration.mjs migrations/002_add_client_id_to_subscribers.sql
   node scripts/run-migration.mjs migrations/003_add_client_id_to_spec_metadata.sql
   node scripts/run-migration.mjs migrations/004_chat_logs.sql
   ```

> **Caution: spec notification emails go to the upstream author.** `app/api/log-metadata/route.ts` sends its notification to a hard-coded address belonging to the original project's author. Change the `to:` address, and the `from:` address if you have a verified Resend domain, **before** you set `RESEND_API_KEY`.

`npm run build` first runs `scripts/cleanup-test-data.mjs`. It deletes rows for the client IDs listed in `excluded-client-ids.txt`. Without a database it prints an error for each table and the build carries on.

### Other hosts

Any host that runs Next.js 16 works, for example Netlify, Railway, Render or a Node server running `npm run build && npm start`. Set the same environment variables. The database code uses `@vercel/postgres`, which works with any Postgres that accepts a `POSTGRES_URL` connection string, such as Neon.

### After deploying

- [ ] The landing page loads at the production URL.
- [ ] One full wizard step works: chat, answer suggestions, generate, approve.
- [ ] **Set a spending limit** for the API key's workspace in the [Claude Console](https://console.anthropic.com/) under **Limits**. The app has no rate limiting, so anyone who reaches it spends from your key.
- [ ] If `NEXT_PUBLIC_GA_ID` is set, your visit appears in Google Analytics **Realtime**.

## Usage

### Workflow

Each step has three phases:

1. **Chat.** The assistant asks targeted questions about your project. Answer them in your own words or pick a suggested option.
2. **Generate.** Click the generate button under **ACTIONS** in the sidebar, for example **GENERATE ONE-PAGER**. Claude writes a markdown document from your conversation and the earlier steps' documents. You can regenerate as often as you like.
3. **Approve.** Review the document in rendered or raw view, then click **APPROVE & NEXT** (**FINALIZE** on the last step) to lock it in and unlock the next step.

When all 4 steps are done, a final-instructions modal offers a ZIP of all documents and a ready-to-paste command for your AI coding agent.

### Sample documents (development only)

In development (`npm run dev`), a **LOAD_SAMPLES** button in the header fills all 4 steps with example documents for a Photo Captioner app. It's handy for testing later steps without chatting through the earlier ones.

### Navigation

- **Step indicators:** click a completed step (green check) to review it.
- **Download one document:** use the download icon next to it under **GENERATED DOCUMENTS** in the sidebar.
- **Download all:** click **DOWNLOAD_ALL.ZIP** in the sidebar.
- **Start over:** click **RESET** in the header. This clears all saved progress.

### Where progress is saved

Everything is stored in the browser's localStorage under the key `wizard-storage`: chat history, generated documents, approvals and the current step. It survives refreshes and browser restarts, but not private windows, other browsers or other devices.

## Project Structure

```
app/
├── api/
│   ├── chat/route.ts               # Streaming chat with Claude
│   ├── generate-doc/route.ts       # Streaming document generation
│   ├── generate-options/route.ts   # Suggested answers (structured output)
│   ├── log-chat/route.ts           # Chat logging (Postgres, optional)
│   ├── log-metadata/route.ts       # Spec metadata + email notification (optional)
│   ├── subscribe/route.ts          # Email sign-up (Postgres, optional)
│   ├── track-event/route.ts        # Cohort events (Postgres, optional)
│   ├── spikelog/route.ts           # Spikelog metrics proxy (optional)
│   └── validate-license/route.ts   # License key check
├── wizard/
│   ├── components/                 # Chat UI, option widgets, preview, modals
│   ├── steps/step{1-4}-config.ts   # Prompts and behaviour for each step
│   ├── utils/                      # Sample docs, step access rules
│   └── page.tsx                    # Wizard page, sidebar, downloads
├── schemas/questionOptions.ts      # Schema for suggested answers
├── utils/                          # Analytics, Spikelog, metadata parsing
├── store.ts                        # Zustand store (localStorage)
├── types.ts                        # Shared TypeScript types
├── layout.tsx                      # Root layout, analytics scripts
└── page.tsx                        # Landing page
migrations/                         # SQL migrations for the optional database
scripts/                            # Migration runner, build-time data cleanup
tests/                              # Vitest unit and integration tests
```

## Customizing

### Changing what the assistant asks or writes

All prompts live in the step configs, `app/wizard/steps/stepN-config.ts`. Change them there rather than in the API routes.

- `systemPrompt` controls how the assistant behaves in the chat.
- `generationPrompt` controls the structure of the generated document.
- `documentInputs` lists which earlier documents the step receives, for example `["onePager", "devSpec"]`.

### Adding a field to step state

1. Add the field to `StepData` in `app/types.ts`.
2. Give it a default in `initialStepData` in `app/store.ts`.
3. Add tests in `tests/unit/store.test.ts`, and check that the value survives a page refresh.

Don't rename the `wizard-storage` key. Doing so discards every user's saved progress.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:3000 |
| `npm run build` | Data cleanup script, then production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with a coverage report |

## Troubleshooting

### Chat or generation fails, or returns nothing

1. Check that `ANTHROPIC_API_KEY` is set in `.env.local` (locally) or in the host's environment variables (deployed), then restart or redeploy.
2. Check that the key is active and its workspace has credit and hasn't hit its spending limit in the [Claude Console](https://console.anthropic.com/).
3. Look at the server log (the terminal running `npm run dev`, or the Vercel function logs). Errors from the API appear there as `AI_APICallError` with the reason.
4. If you set `ANTHROPIC_MODEL`, make sure it's an exact current model ID, such as `claude-opus-5-5`.

### Suggested answers never appear

If `/api/generate-options` returns an empty body and the server log shows `tool_choice: type "tool" and "any" are not supported for this model`, `@ai-sdk/anthropic` is too old for the model. Run `npm install` to get the version in `package-lock.json` (2.0.109 or newer).

### Build errors

Run `npm run build` locally to see the full TypeScript output. The usual causes:
- Dependencies not installed: run `npm install`.
- Node.js older than 20.9.
- Node-only APIs used in an `app/api` route. Those routes run on the Edge Runtime.

### Progress isn't saved

1. Private or incognito windows don't keep localStorage after they close.
2. Check the browser console for storage errors.
3. To reset, click **RESET**, or run `localStorage.removeItem('wizard-storage')` in the console.

## Related Documentation

- **AGENTS.md**: architecture and testing guidance for coding agents
- **CLAUDE.md**: project instructions for Claude Code
- **ANALYTICS.md**: the analytics events the app tracks
- **tests/README.md**: test suite layout and mocking patterns
- **.env.example**: environment variable template

## License

MIT
