# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vibe Scaffold** is a Next.js 16.0.3 application that generates technical specification documents through a 4-step AI-powered wizard interface. Users progress through sequential steps (One Pager → Dev Spec → Prompt Plan → AGENTS.md), each involving chat-based requirement gathering, AI document generation, and approval before proceeding.

## Development Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build (validates TypeScript)
npm run build

# Production server
npm start

# Linting
npm run lint

# Testing
npm test                  # Run all tests once
npm run test:watch        # Watch mode (recommended)
npm run test:ui          # Visual test UI
npm run test:coverage    # Coverage report
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-opus-4-8

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Note**: The codebase is standardized on Anthropic's Claude for all features:
- Chat: `app/api/chat/route.ts`
- Document Generation: `app/api/generate-doc/route.ts`
- Options Generation: `app/api/generate-options/route.ts`

All routes import `@ai-sdk/anthropic` and default to `claude-opus-4-8`.

## Architecture

### State Management (Zustand + localStorage)

- **Store**: `app/store.ts`
- **Key**: `wizard-storage` (persisted in localStorage)
- **Structure**: Each of 4 steps stores `chatHistory`, `generatedDoc`, and `approved` status
- **Navigation**: Users cannot advance until current step is approved

Critical state mapping in `app/wizard/page.tsx:18`:
```typescript
const stepKeyMap = ["onePager", "devSpec", "checklist", "agentsMd"] as const;
```

### Three-Phase Workflow Pattern

Each step follows:
1. **Chat Phase**: Interactive AI conversation to gather requirements (`ChatInterface.tsx`)
2. **Generation Phase**: AI synthesizes chat into markdown document (`/api/generate-doc`)
3. **Approval Phase**: User reviews/approves before next step (`DocumentPreview.tsx`)

### Document Context Flow

Steps automatically receive previous documents as context:
- **Step 1**: No prior context
- **Step 2**: Receives Step 1's `onePager`
- **Step 3**: Receives `onePager` + `devSpec`
- **Step 4**: Receives `onePager` + `devSpec` + `checklist`

Configured via `documentInputs` array in step configs (`app/wizard/steps/step{1-4}-config.ts`).

### Custom Streaming Chat Implementation

`ChatInterface.tsx` uses custom streaming (not `@ai-sdk/react`'s `useChat` hook):
- Manual fetch to `/api/chat`
- Reads streamed text chunks via `ReadableStream`
- Appends chunks to assistant message incrementally
- Required due to SDK version compatibility

```typescript
// Stream handling (ChatInterface.tsx)
const reader = response.body?.getReader();
const decoder = new TextDecoder();
// Reads chunks and appends to latest assistant message
```

### API Routes (Edge Runtime)

Both routes use Edge Runtime (no Node.js APIs):

- **`app/api/chat/route.ts`**: Streaming chat using `streamText()`
  - Accepts: `messages`, `systemPrompt`, `documentInputs`, `stream`
  - Injects document context into system prompt
  - Returns: Text stream response

- **`app/api/generate-doc/route.ts`**: Document generation using `streamText()`
  - Accepts: `chatHistory`, `stepName`, `documentInputs`, `generationPrompt`
  - Formats conversation history + previous docs
  - Returns: Streamed markdown document

### Step Configuration System

Each step defined in `app/wizard/steps/stepN-config.ts`:

```typescript
export interface StepConfig {
  stepNumber: number;           // 1-4
  stepName: string;             // "One Pager", "Dev Spec", etc.
  userInstructions: string;     // Shown to user in UI
  systemPrompt: string;         // AI behavior for chat
  generateButtonText: string;   // Button label
  approveButtonText: string;    // Usually "Approve Draft & Save"
  documentInputs: string[];     // Keys of previous steps for context
  initialGreeting?: string;     // Optional first AI message
  generationPrompt?: string;    // Optional custom generation instructions
}
```

Step configs are the source of truth for AI behavior. Modify these files to change prompts, not API routes.

### File Naming Convention

All downloaded documents use:
- `toUpperCase()` for letters
- `replace(/\s+/g, '_')` for spaces → underscores
- Example: "One Pager" → `ONE_PAGER.md`

Implemented in `app/wizard/page.tsx:59` (individual) and `:90` (ZIP).

## Key Files Structure

```
app/
├── api/
│   ├── chat/route.ts              # Streaming chat (Edge Runtime)
│   ├── generate-doc/route.ts      # Document generation (Edge Runtime)
│   ├── subscribe/route.ts         # Email subscription
│   └── validate-license/route.ts  # License validation
├── wizard/
│   ├── components/
│   │   ├── ChatInterface.tsx      # Custom streaming chat UI
│   │   ├── DocumentPreview.tsx    # Markdown renderer (toggle raw/rendered)
│   │   ├── FinalInstructionsModal.tsx
│   │   └── WizardStep.tsx         # Per-step orchestrator
│   ├── steps/
│   │   ├── step1-config.ts        # One Pager config
│   │   ├── step2-config.ts        # Dev Spec config
│   │   ├── step3-config.ts        # Prompt Plan config
│   │   └── step4-config.ts        # AGENTS.md config
│   ├── utils/
│   │   ├── sampleDocs.ts          # Sample documents for testing
│   │   └── stepAccess.ts          # Step navigation logic
│   └── page.tsx                   # Main wizard page
├── components/
│   ├── Footer.tsx
│   ├── GitHubStars.tsx
│   └── StatsGrid.tsx
├── utils/
│   ├── activityStore.ts           # Activity tracking
│   └── analytics.ts               # Google Analytics wrapper
├── store.ts                       # Zustand state management
├── types.ts                       # TypeScript interfaces
├── layout.tsx                     # Root layout with analytics
└── page.tsx                       # Landing page

tests/
├── setup.ts                       # Global test setup/mocks
├── unit/
│   ├── store.test.ts              # Store tests (24 tests)
│   ├── components/                # Component tests
│   └── utils/
│       ├── analytics.test.ts
│       └── sampleDocs.test.ts     # (17 tests)
└── integration/
    └── api/
        ├── chat.test.ts           # (13 tests)
        └── generate-doc.test.ts   # (19 tests)
```

## Common Modifications

### Changing AI Behavior for a Step

1. Edit `app/wizard/steps/stepN-config.ts`
2. Modify `systemPrompt` (chat behavior) or `generationPrompt` (document format)
3. Test: Chat → Generate → Verify output
4. No code tests needed for prompt-only changes

### Adding Context from Previous Steps

1. Edit step config's `documentInputs` array: `["onePager", "devSpec"]`
2. API route automatically passes these to generation
3. Test manually to verify context usage

### Adding a Field to Step State

1. Update `app/types.ts`:
   ```typescript
   export interface StepData {
     chatHistory: Message[];
     generatedDoc: string | null;
     approved: boolean;
     yourNewField: string;  // Add here
   }
   ```

2. Update `app/store.ts`:
   ```typescript
   const initialStepData: StepData = {
     chatHistory: [],
     generatedDoc: null,
     approved: false,
     yourNewField: "",  // Add here
   };
   ```

3. Add action methods to store if needed
4. **Write tests** in `tests/unit/store.test.ts`
5. Test localStorage persistence after changes

### Adding a 5th Step

1. Update `stepKeyMap` in `app/wizard/page.tsx:18`:
   ```typescript
   const stepKeyMap = ["onePager", "devSpec", "checklist", "agentsMd", "newStep"] as const;
   ```

2. Add to `WizardState["steps"]` in `app/types.ts`:
   ```typescript
   steps: {
     // ... existing steps
     newStep: StepData;
   }
   ```

3. Initialize in `app/store.ts`:
   ```typescript
   steps: {
     // ... existing steps
     newStep: { ...initialStepData },
   }
   ```

4. Create `app/wizard/steps/step5-config.ts` following existing pattern

5. Import in `app/wizard/page.tsx`:
   ```typescript
   import { step5Config } from "./steps/step5-config";
   const stepConfigs = [step1Config, step2Config, step3Config, step4Config, step5Config];
   ```

No component changes needed - `WizardStep` handles all steps generically.

## Testing Requirements

**Framework**: Vitest 4.0.10 with @testing-library/react 16.3.0 and happy-dom

**Current Coverage**: 73 tests across 4 files
- Store: 24 tests
- API routes: 32 tests (13 chat + 19 generate-doc)
- Utilities: 17 tests

**Before Committing**:
1. Run `npm test` - all 73 tests must pass
2. Write tests for new features:
   - Unit tests for pure functions/utilities
   - Integration tests for API routes
   - Component tests for React components
3. Maintain or improve coverage

**Manual Testing Checklist**:
- Chat flow with streaming
- Document generation with context passing
- State persistence (refresh page)
- Download features (individual + ZIP)
- Navigation (Previous/Next, step access)
- "Load Sample Docs" and "Reset Wizard" buttons

## Analytics Tracking

Google Analytics (GA4) events tracked via `app/utils/analytics.ts`:
- `wizard_start` - User enters wizard
- `step_view` - Step navigation
- `step_approved` - Step approval
- `chat_message` - Message submission
- `document_generate` - Generation success/failure
- `document_download` - Individual download
- `bulk_download` - ZIP download
- `wizard_reset` - Reset button
- `wizard_complete` - Final step completion

Configure `NEXT_PUBLIC_GA_ID` in `.env.local` for production tracking.

## Critical Constraints

- **Edge Runtime**: Both API routes use Edge Runtime - no Node.js APIs allowed
- **Model**: Anthropic Claude via `@ai-sdk/anthropic` ONLY. OpenAI is forbidden.
- **Tailwind**: v3.4 (not v4) due to PostCSS compatibility
- **Step Count**: Hardcoded to 4 in multiple places - coordinate changes across `stepKeyMap`, types, and store
- **localStorage Key**: `wizard-storage` - changing this loses all user data
- **No useChat Hook**: Custom streaming implementation required

## What NOT to Change

❌ **Never do this without asking**:
- Change localStorage key (`wizard-storage`)
- Modify `stepKeyMap` order/values without updating types + store
- Use Node.js APIs in Edge Runtime routes
- Remove existing step configs (breaks state mapping)
- Skip writing tests for new features
- Commit code with failing tests

✅ **Always do this**:
- Write tests before or alongside implementation
- Run `npm test` before committing
- Test full wizard flow after changes (all 4 steps)
- Verify localStorage persistence after state changes
- Update AGENTS.md if architecture changes significantly
- Test with and without sample docs loaded

## State Debugging

**Inspect state**:
1. Open DevTools → Application → Local Storage
2. Look for key `wizard-storage`
3. Value is JSON with current wizard state

**Reset state**:
- Click "Reset Wizard" in UI, or
- `localStorage.removeItem('wizard-storage')` in console

## Features to Know About

### Sample Docs Loading
"Load Sample Docs" button (`app/wizard/utils/sampleDocs.ts`) populates all 4 steps with a Parent Time Tracking app example. Useful for testing and demos.

### ZIP Download
"Download All as ZIP" creates `GENERATED_DOCS.zip` using JSZip library. Only includes generated documents, maintains ALL_CAPS_UNDERSCORES.md naming.

### Layout Responsiveness
Main wizard uses responsive grid: `lg:grid-cols-[70%_30%]` (chat/sidebar). Sidebar sticky: `lg:sticky lg:top-20`.

## Related Documentation

- **AGENTS.md**: Comprehensive agent guidance with testing requirements and architecture deep-dive
- **README.md**: User-facing documentation with setup, features, and troubleshooting
- **tests/README.md**: Detailed testing documentation with 73 tests breakdown
- **ANALYTICS.md**: Google Analytics event tracking specification
- **.env.example**: Environment variable template and options
