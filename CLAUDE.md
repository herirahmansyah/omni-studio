# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A monorepo-by-convention containing **three independent Vite + React 19 + TypeScript projects**, plus a minimal root `package.json` for dev convenience. Each project has its own `package.json`, `server.ts`, and dependency tree — always `cd` into the specific project before running commands that affect only that project.

- **`landing/`** — Landing page + reverse proxy. Serves a static SPA at `/` and proxies `/product-studio/*` and `/transition-studio/*` to the two studio apps running on sibling ports. Has no Gemini API integration, no `GEMINI_API_KEY` requirement.
- **`omni-product-studio/`** — Turns product photos into cinematic product-showcase video reels using Gemini Omni Flash (video) and Nano Banana (image) models.
- **`omni-transition-studio/`** — Generates AI video transitions between a first and last frame (preset transition techniques + freeform prompt), plus scene extension and upscaling.

Both studio apps share the same architecture: a Vite + React 19 + TypeScript frontend, served by a single Express server (`server.ts`) that also proxies calls to the Gemini API (`@google/genai`) so the API key never reaches the browser. In dev, Express mounts Vite in middleware mode; in prod, it serves the built `dist/` static assets with an SPA fallback. The landing app follows the same dev/prod pattern for its own SPA, plus adds reverse-proxy middleware for the two studio apps.

## Common Development Commands

### Run all three in parallel (from repo root)

```bash
cd /home/bang/projects/omni-studio
npm install                # installs concurrently + cross-env at root only
npm run dev                # concurrently: landing on :3000, product-studio on :3001, transition-studio on :3002
The root dev script sets PORT=3001/3002 and BASE_PATH=/product-studio,/transition-studio plus matching VITE_BASE_PATH for the two studio apps. landing runs on its default port 3000.

Individual project (run from inside the specific project directory)
bash
npm install                # install deps for this project
npm run dev                 # starts Express+Vite dev server on http://localhost:3000 (unless PORT is set)
npm run build                # vite build (client) + esbuild bundles server.ts to dist/server.cjs
npm start                    # runs the built server: node dist/server.cjs (NODE_ENV=production expected)
npm run lint                 # tsc --noEmit — this is the only "lint", there is no eslint config
npm run clean                 # rm -rf dist server.js
There is no test suite in any project — do not invent test commands.

Environment setup
The two studio apps require GEMINI_API_KEY to call the Gemini API. Create .env.local in each studio app directory (gitignored, loaded via dotenv.config({ path: ['.env.local', '.env'] }) in server.ts) with:

text
GEMINI_API_KEY="your-key-here"
The landing app does not need this variable. Outside of AI Studio's hosted environment, these vars must be set manually; AI Studio normally injects them at runtime.

Building for subpath deployment
The two studio apps are subpath-aware: their Vite build must be told where they'll be served.

bash
# Build for landing-mounted (subpath) mode:
cd omni-product-studio && VITE_BASE_PATH=/product-studio/ npm run build
cd omni-transition-studio && VITE_BASE_PATH=/transition-studio/ npm run build

# Build for standalone mode (default base '/'), no env var needed:
cd omni-product-studio && npm run build
Building without VITE_BASE_PATH produces asset URLs like /assets/index-XXX.js, which will not work when served from /product-studio/ under landing — the browser will hit landing's SPA fallback and get index.html instead of JS, leading to a blank page. The landing app itself always builds with default base /.

Architecture
Server (server.ts) is the only backend, and it's a thin Gemini proxy
Each studio app's server.ts is a single Express app with no database, no auth, no persistence beyond in-memory Maps. The landing server.ts is separate: it serves the landing SPA and reverse-proxies the studio apps; it does not talk to Gemini.

Studio app routes typically:

Accept base64-encoded image/video data + a prompt from the client body.

Call ai.interactions.create(...) (the Omni video/multi-modal API) or ai.models.generateContent(...) (Flash Lite text/image) — the @google/genai SDK is lazily instantiated via a getAiClient()/module-level ai singleton.

For long-running video generation, some endpoints (/api/upscale, transition-studio's /api/omni) return a jobId immediately and poll via GET /api/job/:id and /api/job/:id/result, with an in-memory job Map pruned every 5 minutes (30-minute TTL). Other endpoints (product-studio's /api/generate-video, /api/edit-video) use Gemini's File API and return a fileId/uri that the client polls via /api/file-status/:fileId, then streams through /api/video/:fileId (range-request support + in-memory LRU-ish cache capped at 12 videos) for seekable playback.

Video editing (product-studio) is done via Omni's stateful previous_interaction_id chaining rather than resending the original media.

When adding a new Gemini-backed feature, follow the existing pattern in that app's server.ts: define the request/response shape inline, build inputParts/contents from base64 payloads, and keep all prompt/system-instruction text colocated in server.ts rather than extracting it — this is deliberate in the current code (large system instructions are large because they encode a lot of product-specific creative direction; read them before touching the AI-generation behavior).

Subpath-aware routing (PORT / BASE_PATH / VITE_BASE_PATH)
To let the same studio app run either standalone (port 3000, base /) or mounted under landing (/product-studio, /transition-studio), each studio server.ts reads:

PORT — HTTP port (default 3000).

BASE_PATH — Express mount prefix (default '', meaning root).

Routes are defined on an express.Router() and mounted with app.use(BASE_PATH, router). Static serving and the SPA fallback (app.get(${BASE_PATH}/*, ...)) also respect BASE_PATH. Note the SPA fallback must use *, not *all — Express 4 (path-to-regexp 0.1.x) treats *all as a named parameter that only matches paths ending in the literal string "all", not as a wildcard.

On the Vite side, vite.config.ts reads VITE_BASE_PATH to set base, and each studio app's client code reads API_BASE from src/apiBase.ts:

ts
export const API_BASE = import.meta.env.BASE_URL;
import.meta.env.BASE_URL is always the value of Vite's base config and always ends in /. All client fetch() calls use `${API_BASE}api/...` and video URLs use `${API_BASE}api/video/${fileId}`, so the same client code works standalone and under a subpath.

Landing reverse proxy
landing/server.ts runs two http-proxy-middleware instances. It uses pathFilter (not app.use('/mount', ...)) so Express does not strip the mount prefix from req.url before proxying:

ts
const productStudioProxy = createProxyMiddleware({
  target: `http://localhost:${PRODUCT_STUDIO_PORT}`,
  changeOrigin: true,
  ws: true,
  pathFilter: '/product-studio',
});
Important: the studio apps are mounted at BASE_PATH=/product-studio themselves, so the proxy must forward the request with the prefix intact. Using app.use('/product-studio', proxy) would strip the prefix and cause every proxied request to 404. Do not "simplify" the proxy back to app.use('/mount', ...).

PostCSS config isolation
Each project has its own postcss.config.js containing only autoprefixer. This is deliberate: a /home/bang/postcss.config.js exists on the dev machine and requires autoprefixer from a location that doesn't have it. Vite's PostCSS config resolver walks up the directory tree, so without a local config, builds under /home/bang/projects/ fail with "Failed to load PostCSS config". Do not delete the local postcss.config.js files. Tailwind v4 is provided by @tailwindcss/vite (a Vite plugin), not through PostCSS — the PostCSS config only needs autoprefixer.

Frontend structure
src/main.tsx → src/App.tsx: all app state and orchestration logic lives in one top-level App.tsx component — there is no routing or global state library.

omni-product-studio/src/: data.ts holds hardcoded PRODUCTS/ATMOSPHERES suggestion data, images.ts has toInlineImages/InlineImage helpers for converting File objects to base64 for the API, apiBase.ts exports API_BASE, and components/ has ImageUploader.tsx, VideoOutput.tsx, ScrollRow.tsx.

omni-transition-studio/src/: App.tsx holds transition presets (TRANSITIONS array with id/name/hint/block prompt text) and all UI inline — there is no components/ directory. apiBase.ts exports API_BASE.

landing/src/: App.tsx is the landing page (hero + two cards linking to /product-studio and /transition-studio). No data.ts, no components/ — everything inline.

All projects import local modules with explicit .js extensions (e.g. from './data.js') even though the source is .ts/.tsx — this is required by the allowImportingTsExtensions/bundler moduleResolution config; keep this convention when adding imports.

Path alias @/* → project root is configured in each tsconfig.json and mirrored in each vite.config.ts.

Vite dev server quirk
vite.config.ts in all three projects disables HMR and file watching when DISABLE_HMR=true is set (used by AI Studio's own agent-editing environment to avoid flicker during automated edits). This only matters if that env var is set — normal local dev has HMR on by default.

Assets
assets/.aistudio in each studio app is AI-Studio-managed metadata — don't hand-edit it. metadata.json declares the app's name/description/capabilities as registered with AI Studio (MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API).

Known issues
HMR port conflict in combined dev mode: Vite's default HMR WebSocket port is fixed at 24678 for all three projects. Running npm run dev from root starts three Vite servers that fight over this port; only one wins. Workaround: dev HMR is degraded in combined mode, manual refresh works. Fix would be to set a unique server.hmr.port per project, but this hasn't been done yet.

Repo is not git-initialized. No version control history, no diff baseline, no rollback. Consider running git init and adding a .gitignore that excludes node_modules/, dist/, and **/.env*.