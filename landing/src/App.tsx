import React from 'react';
import { ArrowUpRight, Film, Sparkles } from 'lucide-react';

interface AppCard {
  href: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
}

const APPS: AppCard[] = [
  {
    href: '/product-studio',
    name: 'Omni Product Studio',
    tagline: 'Product photos → cinematic reels',
    description:
      'Turn product photos into cinematic vibe reels with Gemini Omni Flash and Nano Banana Flash Lite.',
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    href: '/transition-studio',
    name: 'Omni Transition Studio',
    tagline: 'First frame → last frame',
    description:
      'Drop in a first and last frame, generate the transition between them with presets or refine further with a prompt box using Omni Flash.',
    icon: <Film className="h-6 w-6" />,
  },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-10 sm:px-10 sm:py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
          Omni Studio
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
          Two AI video studios,<br className="hidden sm:block" /> one home.
        </h1>
        <p className="mt-4 max-w-xl mx-auto text-zinc-400">
          Pick a studio to start generating with Gemini Omni Flash.
        </p>
      </header>

      <main className="flex-1 px-6 pb-16 sm:px-10">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {APPS.map((app) => (
            <a
              key={app.href}
              href={app.href}
              className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-200">
                    {app.icon}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-300" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{app.name}</h2>
                <p className="mt-1 font-mono text-xs uppercase tracking-wide text-zinc-500">
                  {app.tagline}
                </p>
                <p className="mt-3 text-sm text-zinc-400">{app.description}</p>
              </div>
            </a>
          ))}
        </div>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-zinc-600">
        Built on Gemini Omni Flash
      </footer>
    </div>
  );
}
