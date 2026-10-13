# Omni Studio

A monorepo of three Vite + React 19 + TypeScript apps for AI-powered video
creation, backed by Gemini Omni Flash. Each app runs its own Express server
that proxies to the Gemini API so your API key never reaches the browser.

## What's inside

- **`landing/`** — Landing page + reverse proxy. Serves a static SPA at `/` and
  proxies `/product-studio/*` and `/transition-studio/*` to the two studio apps
  running on sibling ports. No Gemini integration, no API key needed.
- **`omni-product-studio/`** — Turn product photos into cinematic showcase
  video reels. Upload product + atmosphere images, pick a style, and generate
  a premium short-form reel with Gemini Omni Flash.
- **`omni-transition-studio/`** — Generate AI video transitions between a first
  and last frame. Choose from six preset techniques or write a freeform prompt.
  Also supports scene extension and upscaling.

## Demo / Screenshots

<!-- TODO: add screenshots here -->

## Requirements

- **Node.js** ≥ 20 (uses Vite 6, React 19, TypeScript 5.8)
- **`GEMINI_API_KEY`** — Required for the two studio apps. Get one from
  [Google AI Studio](https://aistudio.google.com/). The landing app does not
  need this variable.
- **npm** — package manager.

## Quick start

```bash
# 1. Clone
git clone https://github.com/herirahmansyah/omni-studio
cd omni-studio

# 2. Install root tooling (concurrently + cross-env)
npm install

# 3. Set your Gemini key in each studio app
echo 'GEMINI_API_KEY="your-key-here"' > omni-product-studio/.env.local
echo 'GEMINI_API_KEY="your-key-here"' > omni-transition-studio/.env.local

# 4. Run all three in parallel
npm run dev
# → landing:         http://localhost:3000
# → product-studio:  http://localhost:3001/product-studio
# → transition:      http://localhost:3002/transition-studio
```

## Project structure

```
omni-studio/
├── landing/                  # Landing SPA + reverse proxy
│   ├── server.ts             # Express: static + proxy middleware
│   └── src/App.tsx           # Landing page (hero + 2 app cards)
├── omni-product-studio/      # Product photo → video reel
│   ├── server.ts             # Express: Gemini proxy + SPA fallback
│   ├── src/
│   │   ├── App.tsx           # Main app
│   │   ├── data.ts           # PRODUCTS & ATMOSPHERES suggestion data
│   │   ├── images.ts         # Base64 image helpers
│   │   └── components/       # ImageUploader, VideoOutput, ScrollRow
│   └── metadata.json         # AI Studio app registration
├── omni-transition-studio/   # Frame → frame video transitions
│   ├── server.ts             # Express: Gemini proxy + SPA fallback
│   └── src/App.tsx           # Main app (all UI inline)
├── package.json              # Root: `npm run dev` for all 3
├── README.md                 # This file
└── CLAUDE.md                 # Project guidance for AI assistants
```

## Architecture at a glance

Each studio app is a Vite + React 19 frontend served by a single Express
server (`server.ts`). The server also proxies calls to the Gemini API
(`@google/genai`) so the API key never reaches the browser.

Dev mode: Express mounts Vite in middleware mode; HMR works.

Prod mode: Express serves the built `dist/` static assets with an SPA
fallback (`app.get('*', ...)`).

The two studio apps are subpath-aware — they can run standalone (base `/`,
port 3000) or mounted under the landing page (`/product-studio`,
`/transition-studio`). Each `server.ts` reads `PORT` and `BASE_PATH` from env;
Vite reads `VITE_BASE_PATH` for asset URLs; client code reads `API_BASE` from
`import.meta.env.BASE_URL` so the same code works in both modes.

The landing app runs two `http-proxy-middleware` instances using `pathFilter`
(not `app.use('/mount', ...)`) so Express does not strip the mount prefix
before proxying.

## Running individual apps

```bash
# Product studio (standalone)
cd omni-product-studio && npm install && npm run dev

# Transition studio (standalone)
cd omni-transition-studio && npm install && npm run dev

# Landing only
cd landing && npm install && npm run dev
```

## Building for production

```bash
# Build for landing-mounted (subpath) mode:
cd omni-product-studio && VITE_BASE_PATH=/product-studio/ npm run build
cd omni-transition-studio && VITE_BASE_PATH=/transition-studio/ npm run build

# Build for standalone mode (default base '/'):
cd omni-product-studio && npm run build
```

Building without `VITE_BASE_PATH` produces asset URLs like
`/assets/index-XXX.js`, which will not work when served from `/product-studio/`
under landing — the browser would hit landing's SPA fallback and get `index.html`
instead of JS, leading to a blank page.

## Configuration

| Variable       | Where       | Default            | Purpose                          |
| -------------- | ----------- | ------------------ | -------------------------------- |
| `PORT`         | all 3 apps  | 3000               | HTTP port                        |
| `BASE_PATH`    | studio apps | `''`               | Express mount prefix             |
| `VITE_BASE_PATH` | studio apps | `/`               | Vite asset base path             |
| `GEMINI_API_KEY` | studio apps | —                 | Gemini API key (required)        |
| `APP_URL`      | studio apps | —                  | Self-referential URL (optional)  |

## License & provenance

No license is applied to this repository. This is deliberate.

The two studio apps (`omni-product-studio`, `omni-transition-studio`)
originated from Google AI Studio's app gallery.
They were subsequently restructured, merged into a single repository with a
landing page, made subpath-aware, and had bugs fixed — work done by the
repository owner.

Because portions of the code are AI-generated, no copyright claim is made
over those portions, and no license is granted. Under GitHub's default
behavior, absence of a license means all rights reserved by the repository
owner.

If you'd like to use this code for any purpose, please open an issue to
discuss.

## Acknowledgements

- Gemini API — Omni Flash, Nano Banana Flash Lite
- Google AI Studio — hosting & runtime env
- Vite — build tool & dev server
- React — UI framework
- Tailwind CSS — styling
- Express — HTTP server & proxy
- http-proxy-middleware — reverse proxy