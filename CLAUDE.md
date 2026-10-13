# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo-by-convention containing two **independent, unrelated** Google AI Studio apps, each in its own subdirectory with its own `package.json`, `server.ts`, and dependency tree. There is no shared root tooling — always `cd` into the specific app before running commands.

- **`omni-product-studio/`** — Turns product photos into cinematic product-showcase video reels using Gemini Omni Flash (video) and Nano Banana (image) models.
- **`omni-transition-studio/`** — Generates AI video transitions between a first and last frame (preset transition techniques + freeform prompt), plus scene extension and upscaling.

Both apps share the same architecture: a Vite + React 19 + TypeScript frontend, served by a single Express server (`server.ts`) that also proxies calls to the Gemini API (`@google/genai`) so the API key never reaches the browser. In dev, Express mounts Vite in middleware mode; in prod, it serves the built `dist/` static assets with an SPA fallback.

## Common Development Commands

Run from inside the relevant app directory (`omni-product-studio/` or `omni-transition-studio/`):

```bash
npm install                # install deps (product-studio uses npm; transition-studio has a bun.lock but npm/package.json also works)
npm run dev                 # starts the Express+Vite dev server (tsx server.ts) on http://localhost:3000
npm run build                # vite build (client) + esbuild bundles server.ts to dist/server.cjs
npm start                    # runs the built server: node dist/server.cjs (NODE_ENV=production expected)
npm run lint                 # tsc --noEmit — this is the only "lint", there is no eslint config
npm run clean                 # rm -rf dist server.js
```

There is no test suite in either app — do not invent test commands.

### Environment setup

Both apps require `GEMINI_API_KEY` to call the Gemini API. Create `.env.local` (gitignored, loaded via `dotenv.config({ path: ['.env.local', '.env'] })` in `server.ts`) with:

```
GEMINI_API_KEY="your-key-here"
```

Outside of AI Studio's hosted environment, these vars must be set manually; AI Studio normally injects them at runtime.

## Architecture

### Server (`server.ts`) is the only backend, and it's a thin Gemini proxy

Each app's `server.ts` is a single Express app (port 3000) with no database, no auth, no persistence beyond in-memory `Map`s. Routes typically:
1. Accept base64-encoded image/video data + a prompt from the client body.
2. Call `ai.interactions.create(...)` (the Omni video/multi-modal API) or `ai.models.generateContent(...)` (Flash Lite text/image) — the `@google/genai` SDK is lazily instantiated via a `getAiClient()`/module-level `ai` singleton.
3. For long-running video generation, some endpoints (`/api/upscale`, transition-studio's `/api/omni`) return a `jobId` immediately and poll via `GET /api/job/:id` and `/api/job/:id/result`, with an in-memory job `Map` pruned every 5 minutes (30-minute TTL). Other endpoints (product-studio's `/api/generate-video`, `/api/edit-video`) use Gemini's File API and return a `fileId`/`uri` that the client polls via `/api/file-status/:fileId`, then streams through `/api/video/:fileId` (range-request support + in-memory LRU-ish cache capped at 12 videos) for seekable playback.
4. Video *editing* (product-studio) is done via Omni's stateful `previous_interaction_id` chaining rather than resending the original media.

When adding a new Gemini-backed feature, follow the existing pattern in that app's `server.ts`: define the request/response shape inline, build `inputParts`/`contents` from base64 payloads, and keep all prompt/system-instruction text colocated in `server.ts` rather than extracting it — this is deliberate in the current code (large system instructions are large because they encode a lot of product-specific creative direction; read them before touching the AI-generation behavior).

### Frontend structure

- `src/main.tsx` → `src/App.tsx`: all app state and orchestration logic lives in one top-level `App.tsx` component (502 lines in product-studio, 841 in transition-studio) — there is no routing or global state library.
- `omni-product-studio/src/`: `data.ts` holds hardcoded `PRODUCTS`/`ATMOSPHERES` suggestion data, `images.ts` has `toInlineImages`/`InlineImage` helpers for converting File objects to base64 for the API, and `components/` has `ImageUploader.tsx`, `VideoOutput.tsx`, `ScrollRow.tsx`.
- `omni-transition-studio/src/App.tsx`: transition presets (`TRANSITIONS` array with `id`/`name`/`hint`/`block` prompt text) and all UI are inlined in `App.tsx` itself — there's no `components/` directory in this app.
- Both apps import local modules with explicit `.js` extensions (e.g. `from './data.js'`) even though the source is `.ts`/`.tsx` — this is required by the `allowImportingTsExtensions`/bundler moduleResolution config; keep this convention when adding imports.
- Path alias `@/*` → project root is configured in `tsconfig.json` and mirrored in `vite.config.ts`.

### Vite dev server quirk

`vite.config.ts` in both apps disables HMR and file watching when `DISABLE_HMR=true` is set (used by AI Studio's own agent-editing environment to avoid flicker during automated edits). This only matters if that env var is set — normal local dev has HMR on by default.

### Assets

`assets/.aistudio` in each app is AI-Studio-managed metadata — don't hand-edit it. `metadata.json` declares the app's name/description/capabilities as registered with AI Studio (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).
